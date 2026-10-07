import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";
import {
  authenticate,
  createGroup,
  joinGroup,
  createCampaign,
  provisionCampaignWithMj,
  createPendingSheet,
} from "./sheetTestHelpers";

/**
 * Tests d'intégration HTTP des routes fiches (`/character-sheets`) et des personnages d'une
 * campagne (`/campaigns/:id/...`), pile Express réelle sur doublures.
 *
 * Modèle « une fiche = une campagne » (refactor) : une fiche est créée rattachée à UNE campagne
 * (campaignId obligatoire), en statut PENDING. Le MJ de la campagne valide (`accept`, → ACCEPTED)
 * ou refuse (`refuse`, → suppression de la fiche). On copie une fiche vers une autre campagne via
 * `POST /character-sheets/:id/copy`. Le joueur ne peut pas être le MJ de la campagne choisie.
 *
 * Contrat « groupe d'amis » (Étape 3) : une fiche appartient à un groupe (`groupId`), visibilité
 * « tout le groupe » en lecture, mais création/suppression/édition restent contraintes
 * (propriétaire / MJ).
 */
describe("Character sheet routes (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  describe("CRUD fiches", () => {
    it("POST /character-sheets crée une fiche PENDING rattachée à une campagne (201)", async () => {
      const agent = await authenticate(app, "p@test.com");
      const groupId = await createGroup(agent);
      const { campaignId } = await provisionCampaignWithMj(app, agent, groupId);

      const res = await agent
        .post("/character-sheets")
        .send({ name: "Aragorn", groupId, campaignId });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: "Aragorn" });
      expect(typeof res.body.id).toBe("string");
      // Le contrat doit être homogène avec GET /character-sheets : ownerId présent
      // (sinon le DTO front, qui l'exige, échoue à parser la réponse → fausse "erreur réseau").
      expect(typeof res.body.ownerId).toBe("string");
    });

    it("POST /character-sheets sans campagne renvoie 404 (CAMPAIGN_NOT_FOUND)", async () => {
      const agent = await authenticate(app, "p@test.com");
      const groupId = await createGroup(agent);

      const res = await agent.post("/character-sheets").send({ name: "Aragorn", groupId });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CAMPAIGN_NOT_FOUND");
    });

    it("POST /character-sheets par le MJ de la campagne choisie renvoie 409 (GM_CANNOT_JOIN_OWN_CAMPAIGN)", async () => {
      // mj est admin du groupe : il crée sa propre campagne et ne peut pas y créer de fiche.
      const mj = await authenticate(app, "mj@test.com");
      const groupId = await createGroup(mj);
      const campaignId = await createCampaign(mj, groupId, "Sa campagne");

      const res = await mj
        .post("/character-sheets")
        .send({ name: "Fiche MJ", groupId, campaignId });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("GM_CANNOT_JOIN_OWN_CAMPAIGN");
    });

    it("POST /character-sheets par un non-membre du groupe renvoie 403 (NOT_GROUP_MEMBER)", async () => {
      const owner = await authenticate(app, "owner@test.com");
      const groupId = await createGroup(owner);
      const { campaignId } = await provisionCampaignWithMj(app, owner, groupId);
      const intrus = await authenticate(app, "intrus@test.com");

      const res = await intrus
        .post("/character-sheets")
        .send({ name: "Aragorn", groupId, campaignId });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_GROUP_MEMBER");
    });

    it("GET /character-sheets ne renvoie que MES fiches du groupe (pas celles des autres membres)", async () => {
      const me = await authenticate(app, "me@test.com");
      const groupId = await createGroup(me);
      await createPendingSheet(app, me, groupId, "Une");
      await createPendingSheet(app, me, groupId, "Deux");

      // Fiche d'un autre membre du groupe : NE doit PAS apparaître (seules MES fiches sont listées).
      const mate = await authenticate(app, "mate@test.com");
      await joinGroup(me, groupId, mate, "mate@test.com");
      await createPendingSheet(app, mate, groupId, "Trois");

      // Une fiche dans un AUTRE groupe ne doit pas apparaître non plus.
      const other = await authenticate(app, "other@test.com");
      const otherGroupId = await createGroup(other, "Autre groupe");
      await createPendingSheet(app, other, otherGroupId, "Autre");

      const res = await me.get(`/character-sheets?groupId=${groupId}`);
      expect(res.status).toBe(200);
      expect(res.body.characterSheets).toHaveLength(2);
      const names = res.body.characterSheets.map((s: { name: string }) => s.name).sort();
      expect(names).toEqual(["Deux", "Une"]);
    });

    it("GET /character-sheets par un non-membre du groupe renvoie 403 (NOT_GROUP_MEMBER)", async () => {
      const owner = await authenticate(app, "owner@test.com");
      const groupId = await createGroup(owner);
      await createPendingSheet(app, owner, groupId, "Privée");
      const intrus = await authenticate(app, "intrus@test.com");

      const res = await intrus.get(`/character-sheets?groupId=${groupId}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_GROUP_MEMBER");
    });

    it("POST /character-sheets avec un nom vide renvoie 400", async () => {
      const agent = await authenticate(app, "p@test.com");
      const groupId = await createGroup(agent);
      const { campaignId } = await provisionCampaignWithMj(app, agent, groupId);
      const res = await agent.post("/character-sheets").send({ name: "   ", groupId, campaignId });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_CHARACTER_SHEET_NAME");
    });

    it("DELETE /character-sheets/:id supprime ma fiche (204)", async () => {
      const agent = await authenticate(app, "p@test.com");
      const groupId = await createGroup(agent);
      const { sheet } = await createPendingSheet(app, agent, groupId, "À supprimer");
      const res = await agent.delete(`/character-sheets/${sheet.id}`);
      expect(res.status).toBe(204);
      expect(
        (await agent.get(`/character-sheets?groupId=${groupId}`)).body.characterSheets,
      ).toHaveLength(0);
    });

    it("DELETE la fiche d'un autre (même membre du groupe) renvoie 403", async () => {
      // La suppression reste réservée au propriétaire, même pour un autre membre du groupe.
      const owner = await authenticate(app, "owner@test.com");
      const groupId = await createGroup(owner);
      const { sheet } = await createPendingSheet(app, owner, groupId, "Privée");

      const mate = await authenticate(app, "mate@test.com");
      await joinGroup(owner, groupId, mate, "mate@test.com");

      const res = await mate.delete(`/character-sheets/${sheet.id}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("POST /character-sheets sans cookie renvoie 401", async () => {
      const res = await request(app).post("/character-sheets").send({ name: "X" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHENTICATED");
    });
  });

  describe("Détail et mise à jour d'une fiche", () => {
    it("GET /character-sheets/:id renvoie la fiche complète (200)", async () => {
      const agent = await authenticate(app, "p@test.com");
      const groupId = await createGroup(agent);
      const { sheet } = await createPendingSheet(app, agent, groupId, "Aragorn");

      const res = await agent.get(`/character-sheets/${sheet.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: sheet.id, name: "Aragorn" });
      // Les champs détaillés : les champs sans défaut sont null, les champs avec défaut ont leur valeur.
      expect(res.body.peupleId).toBeNull();
      expect(res.body.vigueur).toBe(0); // défaut à la création
      expect(res.body.notes).toBeNull();
      expect(res.body.formation).toBeNull(); // sans formation/peuple, les blocs résolus sont null
      expect(res.body.peuple).toBeNull();
    });

    it("GET /character-sheets/:id résout la formation (stat/bonus + compétences) et le peuple", async () => {
      const agent = await authenticate(app, "p@test.com");
      const groupId = await createGroup(agent);
      const { sheet } = await createPendingSheet(app, agent, groupId, "Gimli");

      // Catalogue : compétence liée à la formation + formation avec bonus + peuple avec bonus.
      const epee = await agent.post("/reference/competences").send({ name: "Épée", groupId });
      const formation = await agent.post("/reference/formations").send({
        name: "Guerrier",
        groupId,
        stat: "vigueur",
        bonus: 2,
        competenceIds: [epee.body.id],
      });
      // Peuple créé avec l'ANCIEN format (`stat`/`bonus`) : c'est le chemin de compatibilité pour
      // les clients pas encore mis à jour. Le back doit le convertir en une entrée de `statBonuses`.
      const peuple = await agent
        .post("/reference/peoples")
        .send({ name: "Nain", groupId, stat: "vigueur", bonus: 1 });
      await agent
        .put(`/character-sheets/${sheet.id}`)
        .send({ name: "Gimli", formationId: formation.body.id, peupleId: peuple.body.id });

      const res = await agent.get(`/character-sheets/${sheet.id}`);
      expect(res.status).toBe(200);
      expect(res.body.formationId).toBe(formation.body.id); // id brut conservé (rétrocompat)
      expect(res.body.formation).toEqual({
        id: formation.body.id,
        name: "Guerrier",
        stat: "vigueur",
        bonus: 2,
        competences: [{ id: epee.body.id, name: "Épée" }],
      });
      expect(res.body.peuple).toEqual({
        id: peuple.body.id,
        name: "Nain",
        statBonuses: [{ stat: "vigueur", bonus: 1 }],
      });
      // Les stats de base de la fiche ne sont PAS modifiées par le bonus (affichage côté front).
      expect(res.body.vigueur).toBeNull();
    });

    it("GET /character-sheets/:id applique PLUSIEURS bonus de peuple aux totaux de la fiche", async () => {
      const agent = await authenticate(app, "multi@test.com");
      const groupId = await createGroup(agent);
      const { sheet } = await createPendingSheet(app, agent, groupId, "Gimli");

      const peuple = await agent.post("/reference/peoples").send({
        name: "Nain",
        groupId,
        statBonuses: [
          { stat: "vigueur", bonus: 2 },
          { stat: "social", bonus: 1 },
        ],
      });
      expect(peuple.status).toBe(201);
      expect(peuple.body.statBonuses).toEqual([
        { stat: "vigueur", bonus: 2 },
        { stat: "social", bonus: 1 },
      ]);
      // Un peuple n'expose plus le couple historique.
      expect(peuple.body.stat).toBeNull();
      expect(peuple.body.bonus).toBeNull();

      await agent.put(`/character-sheets/${sheet.id}`).send({
        name: "Gimli",
        peupleId: peuple.body.id,
        vigueur: 4,
        social: 1,
        dexterite: 3,
      });

      const res = await agent.get(`/character-sheets/${sheet.id}`);
      expect(res.status).toBe(200);
      expect(res.body.peuple.statBonuses).toEqual([
        { stat: "vigueur", bonus: 2 },
        { stat: "social", bonus: 1 },
      ]);
      expect(res.body.vigueurTotale).toBe(6); // 4 + 2
      expect(res.body.socialTotale).toBe(2); // 1 + 1
      expect(res.body.dexteriteTotale).toBe(3); // aucun bonus
      expect(res.body.pointsDeVie).toBe(16); // 10 + vigueur totale
    });

    it("POST /reference/peoples refuse (400) deux bonus sur la même statistique", async () => {
      const agent = await authenticate(app, "dup@test.com");
      const groupId = await createGroup(agent);

      const res = await agent.post("/reference/peoples").send({
        name: "Nain",
        groupId,
        statBonuses: [
          { stat: "vigueur", bonus: 2 },
          { stat: "vigueur", bonus: 3 },
        ],
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_STAT_BONUS");
    });

    it("GET la fiche d'un autre membre du même groupe réussit (200, visibilité groupe)", async () => {
      const owner = await authenticate(app, "owner@test.com");
      const groupId = await createGroup(owner);
      const { sheet } = await createPendingSheet(app, owner, groupId, "Aragorn");

      const mate = await authenticate(app, "mate@test.com");
      await joinGroup(owner, groupId, mate, "mate@test.com");

      const res = await mate.get(`/character-sheets/${sheet.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: sheet.id, name: "Aragorn" });
    });

    it("PUT /character-sheets/:id met à jour la fiche, GET reflète les changements", async () => {
      const agent = await authenticate(app, "p@test.com");
      const groupId = await createGroup(agent);
      const { sheet } = await createPendingSheet(app, agent, groupId, "Aragorn");

      const put = await agent.put(`/character-sheets/${sheet.id}`).send({
        name: "Strider",
        niveau: 5,
        age: 87,
        sexe: "M",
        vigueur: 7,
        notes: "Garde du Nord",
        purse: { gold: 1, silver: 50, copper: 0 },
      });
      expect(put.status).toBe(200);
      expect(put.body).toMatchObject({ name: "Strider", niveau: 5, sexe: "M" });
      expect(put.body.purse).toEqual({ gold: 1, silver: 50, copper: 0 });

      const res = await agent.get(`/character-sheets/${sheet.id}`);
      expect(res.body.name).toBe("Strider");
      expect(res.body.vigueur).toBe(7);
      expect(res.body.notes).toBe("Garde du Nord");
      expect(res.body.purse).toEqual({ gold: 1, silver: 50, copper: 0 });
    });

    it("PUT avec un sexe invalide renvoie 400", async () => {
      const agent = await authenticate(app, "p@test.com");
      const groupId = await createGroup(agent);
      const { sheet } = await createPendingSheet(app, agent, groupId, "Aragorn");

      const res = await agent.put(`/character-sheets/${sheet.id}`).send({ name: "A", sexe: "Z" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_SEX");
    });

    it("PUT avec un nom vide renvoie 400", async () => {
      const agent = await authenticate(app, "p@test.com");
      const groupId = await createGroup(agent);
      const { sheet } = await createPendingSheet(app, agent, groupId, "Aragorn");

      const res = await agent.put(`/character-sheets/${sheet.id}`).send({ name: "   " });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_CHARACTER_SHEET_NAME");
    });

    it("GET /character-sheets/:id inconnu renvoie 404", async () => {
      const agent = await authenticate(app, "p@test.com");
      const res = await agent.get("/character-sheets/inconnu");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CHARACTER_SHEET_NOT_FOUND");
    });

    it("GET la fiche d'un autre (non-membre du groupe) renvoie 403", async () => {
      // Nouvelle règle : l'accès est réservé aux MEMBRES du groupe de la fiche.
      const owner = await authenticate(app, "owner@test.com");
      const groupId = await createGroup(owner);
      const { sheet } = await createPendingSheet(app, owner, groupId, "Privée");
      const intrus = await authenticate(app, "intrus@test.com");

      const res = await intrus.get(`/character-sheets/${sheet.id}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_GROUP_MEMBER");
    });

    it("PUT la fiche d'un autre (même membre, non-MJ) renvoie 403", async () => {
      // L'édition reste réservée au propriétaire (ou au MJ d'une campagne liée).
      const owner = await authenticate(app, "owner@test.com");
      const groupId = await createGroup(owner);
      const { sheet } = await createPendingSheet(app, owner, groupId, "Privée");

      const mate = await authenticate(app, "mate@test.com");
      await joinGroup(owner, groupId, mate, "mate@test.com");

      const res = await mate.put(`/character-sheets/${sheet.id}`).send({ name: "Hack" });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("GET /character-sheets/:id sans cookie renvoie 401", async () => {
      const res = await request(app).get("/character-sheets/whatever");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHENTICATED");
    });
  });
});
