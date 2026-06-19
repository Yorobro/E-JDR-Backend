import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";

/**
 * Tests d'intégration HTTP des routes fiches (`/character-sheets`) et de la liaison
 * campagne↔fiches (`/campaigns/:id/characters`), pile Express réelle sur doublures.
 *
 * Contrat « groupe d'amis » (Étape 3) : une fiche appartient à un groupe (`groupId`). La
 * visibilité est « tout le groupe » (lecture par tout membre), mais création/suppression et
 * édition restent contraintes (propriétaire / MJ). Voir le détail dans chaque test.
 */
describe("Character sheet routes (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  /** Inscrit un utilisateur et renvoie un agent conservant ses cookies de session. */
  async function authenticate(email: string): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, pseudo: "Gandalf", password: "password123" });
    return agent;
  }

  /** Crée un groupe (créateur = ADMIN/membre) et renvoie son ID. */
  async function createGroup(
    agent: ReturnType<typeof request.agent>,
    name = "Groupe",
  ): Promise<string> {
    const res = await agent.post("/groups").send({ name });
    return res.body.id as string;
  }

  /**
   * Fait entrer `invitee` dans le groupe `groupId` : `inviter` invite par email, `invitee`
   * accepte. Les deux utilisateurs deviennent alors membres du même groupe.
   */
  async function joinGroup(
    inviter: ReturnType<typeof request.agent>,
    groupId: string,
    invitee: ReturnType<typeof request.agent>,
    inviteeEmail: string,
  ): Promise<void> {
    const inv = await inviter.post(`/groups/${groupId}/invitations`).send({ email: inviteeEmail });
    await invitee.post(`/invitations/${inv.body.invitationId}/accept`);
  }

  describe("CRUD fiches", () => {
    it("POST /character-sheets crée une fiche (201)", async () => {
      const agent = await authenticate("p@test.com");
      const groupId = await createGroup(agent);
      const res = await agent.post("/character-sheets").send({ name: "Aragorn", groupId });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: "Aragorn" });
      expect(typeof res.body.id).toBe("string");
      // Le contrat doit être homogène avec GET /character-sheets : ownerId présent
      // (sinon le DTO front, qui l'exige, échoue à parser la réponse → fausse "erreur réseau").
      expect(typeof res.body.ownerId).toBe("string");
    });

    it("POST /character-sheets par un non-membre du groupe renvoie 403 (NOT_GROUP_MEMBER)", async () => {
      const owner = await authenticate("owner@test.com");
      const groupId = await createGroup(owner);
      const intrus = await authenticate("intrus@test.com");

      const res = await intrus.post("/character-sheets").send({ name: "Aragorn", groupId });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_GROUP_MEMBER");
    });

    it("GET /character-sheets renvoie toutes les fiches du groupe (visibilité groupe)", async () => {
      const me = await authenticate("me@test.com");
      const groupId = await createGroup(me);
      await me.post("/character-sheets").send({ name: "Une", groupId });
      await me.post("/character-sheets").send({ name: "Deux", groupId });

      // Un autre membre du même groupe crée aussi une fiche : elle doit être visible par tous.
      const mate = await authenticate("mate@test.com");
      await joinGroup(me, groupId, mate, "mate@test.com");
      await mate.post("/character-sheets").send({ name: "Trois", groupId });

      // Une fiche dans un AUTRE groupe ne doit pas apparaître.
      const other = await authenticate("other@test.com");
      const otherGroupId = await createGroup(other, "Autre groupe");
      await other.post("/character-sheets").send({ name: "Autre", groupId: otherGroupId });

      const res = await me.get(`/character-sheets?groupId=${groupId}`);
      expect(res.status).toBe(200);
      expect(res.body.characterSheets).toHaveLength(3);
      const names = res.body.characterSheets.map((s: { name: string }) => s.name).sort();
      expect(names).toEqual(["Deux", "Trois", "Une"]);
    });

    it("GET /character-sheets par un non-membre du groupe renvoie 403 (NOT_GROUP_MEMBER)", async () => {
      const owner = await authenticate("owner@test.com");
      const groupId = await createGroup(owner);
      await owner.post("/character-sheets").send({ name: "Privée", groupId });
      const intrus = await authenticate("intrus@test.com");

      const res = await intrus.get(`/character-sheets?groupId=${groupId}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_GROUP_MEMBER");
    });

    it("POST /character-sheets avec un nom vide renvoie 400", async () => {
      const agent = await authenticate("p@test.com");
      const groupId = await createGroup(agent);
      const res = await agent.post("/character-sheets").send({ name: "   ", groupId });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_CHARACTER_SHEET_NAME");
    });

    it("DELETE /character-sheets/:id supprime ma fiche (204)", async () => {
      const agent = await authenticate("p@test.com");
      const groupId = await createGroup(agent);
      const created = await agent.post("/character-sheets").send({ name: "À supprimer", groupId });
      const res = await agent.delete(`/character-sheets/${created.body.id}`);
      expect(res.status).toBe(204);
      expect(
        (await agent.get(`/character-sheets?groupId=${groupId}`)).body.characterSheets,
      ).toHaveLength(0);
    });

    it("DELETE la fiche d'un autre (même membre du groupe) renvoie 403", async () => {
      // La suppression reste réservée au propriétaire, même pour un autre membre du groupe.
      const owner = await authenticate("owner@test.com");
      const groupId = await createGroup(owner);
      const created = await owner.post("/character-sheets").send({ name: "Privée", groupId });

      const mate = await authenticate("mate@test.com");
      await joinGroup(owner, groupId, mate, "mate@test.com");

      const res = await mate.delete(`/character-sheets/${created.body.id}`);
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
      const agent = await authenticate("p@test.com");
      const groupId = await createGroup(agent);
      const created = await agent.post("/character-sheets").send({ name: "Aragorn", groupId });

      const res = await agent.get(`/character-sheets/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: created.body.id, name: "Aragorn" });
      // Les champs détaillés sont présents et null à la création (formation/peuple = id de référence).
      expect(res.body.peupleId).toBeNull();
      expect(res.body.vigueur).toBeNull();
      expect(res.body.notes).toBeNull();
    });

    it("GET la fiche d'un autre membre du même groupe réussit (200, visibilité groupe)", async () => {
      const owner = await authenticate("owner@test.com");
      const groupId = await createGroup(owner);
      const created = await owner.post("/character-sheets").send({ name: "Aragorn", groupId });

      const mate = await authenticate("mate@test.com");
      await joinGroup(owner, groupId, mate, "mate@test.com");

      const res = await mate.get(`/character-sheets/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: created.body.id, name: "Aragorn" });
    });

    it("PUT /character-sheets/:id met à jour la fiche, GET reflète les changements", async () => {
      const agent = await authenticate("p@test.com");
      const groupId = await createGroup(agent);
      const created = await agent.post("/character-sheets").send({ name: "Aragorn", groupId });

      const put = await agent.put(`/character-sheets/${created.body.id}`).send({
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

      const res = await agent.get(`/character-sheets/${created.body.id}`);
      expect(res.body.name).toBe("Strider");
      expect(res.body.vigueur).toBe(7);
      expect(res.body.notes).toBe("Garde du Nord");
      expect(res.body.purse).toEqual({ gold: 1, silver: 50, copper: 0 });
    });

    it("PUT avec un sexe invalide renvoie 400", async () => {
      const agent = await authenticate("p@test.com");
      const groupId = await createGroup(agent);
      const created = await agent.post("/character-sheets").send({ name: "Aragorn", groupId });

      const res = await agent
        .put(`/character-sheets/${created.body.id}`)
        .send({ name: "A", sexe: "Z" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_SEX");
    });

    it("PUT avec un nom vide renvoie 400", async () => {
      const agent = await authenticate("p@test.com");
      const groupId = await createGroup(agent);
      const created = await agent.post("/character-sheets").send({ name: "Aragorn", groupId });

      const res = await agent.put(`/character-sheets/${created.body.id}`).send({ name: "   " });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_CHARACTER_SHEET_NAME");
    });

    it("GET /character-sheets/:id inconnu renvoie 404", async () => {
      const agent = await authenticate("p@test.com");
      const res = await agent.get("/character-sheets/inconnu");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CHARACTER_SHEET_NOT_FOUND");
    });

    it("GET la fiche d'un autre (non-membre du groupe) renvoie 403", async () => {
      // Nouvelle règle : l'accès est réservé aux MEMBRES du groupe de la fiche.
      const owner = await authenticate("owner@test.com");
      const groupId = await createGroup(owner);
      const created = await owner.post("/character-sheets").send({ name: "Privée", groupId });
      const intrus = await authenticate("intrus@test.com");

      const res = await intrus.get(`/character-sheets/${created.body.id}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_GROUP_MEMBER");
    });

    it("PUT la fiche d'un autre (même membre, non-MJ) renvoie 403", async () => {
      // L'édition reste réservée au propriétaire (ou au MJ d'une campagne liée).
      const owner = await authenticate("owner@test.com");
      const groupId = await createGroup(owner);
      const created = await owner.post("/character-sheets").send({ name: "Privée", groupId });

      const mate = await authenticate("mate@test.com");
      await joinGroup(owner, groupId, mate, "mate@test.com");

      const res = await mate.put(`/character-sheets/${created.body.id}`).send({ name: "Hack" });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("GET /character-sheets/:id sans cookie renvoie 401", async () => {
      const res = await request(app).get("/character-sheets/whatever");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHENTICATED");
    });
  });

  /** Crée un groupe puis une campagne ; renvoie la réponse complète de POST /campaigns. */
  async function createCampaign(
    agent: ReturnType<typeof request.agent>,
    name = "Ma campagne",
  ): Promise<{ body: { id: string }; groupId: string }> {
    const grp = await agent.post("/groups").send({ name: "Groupe" });
    const groupId = grp.body.id as string;
    const campaign = await agent.post("/campaigns").send({ name, groupId });
    return { body: campaign.body, groupId };
  }

  describe("Liaison campagne↔fiches", () => {
    it("rattache la fiche d'un joueur à la campagne d'un MJ (201) puis la liste", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await createCampaign(mj, "Ma campagne");

      // Le joueur doit être membre du groupe de la campagne et créer sa fiche DANS ce groupe.
      const player = await authenticate("player@test.com");
      await joinGroup(mj, campaign.groupId, player, "player@test.com");
      const sheet = await player
        .post("/character-sheets")
        .send({ name: "Legolas", groupId: campaign.groupId });

      const link = await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });
      expect(link.status).toBe(201);

      const list = await mj.get(`/campaigns/${campaign.body.id}/characters`);
      expect(list.status).toBe(200);
      expect(list.body.characters).toHaveLength(1);
      expect(list.body.characters[0].name).toBe("Legolas");
    });

    it("refuse (409) que le MJ rattache une de ses fiches à sa propre campagne", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await createCampaign(mj, "Ma campagne");
      const sheet = await mj
        .post("/character-sheets")
        .send({ name: "Fiche du MJ", groupId: campaign.groupId });

      const res = await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("GM_CANNOT_JOIN_OWN_CAMPAIGN");
    });

    it("refuse (409) un rattachement en double", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await createCampaign(mj, "C");
      const player = await authenticate("player@test.com");
      await joinGroup(mj, campaign.groupId, player, "player@test.com");
      const sheet = await player
        .post("/character-sheets")
        .send({ name: "S", groupId: campaign.groupId });

      await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });
      const dup = await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });

      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe("SHEET_ALREADY_IN_CAMPAIGN");
    });

    it("refuse (403) de rattacher une fiche d'un autre groupe que celui de la campagne", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await createCampaign(mj, "C");

      // Le joueur a une fiche dans SON propre groupe, distinct de celui de la campagne.
      const player = await authenticate("player@test.com");
      const playerGroupId = await createGroup(player, "Groupe du joueur");
      const sheet = await player
        .post("/character-sheets")
        .send({ name: "Hors groupe", groupId: playerGroupId });

      const res = await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("détache une fiche (204)", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await createCampaign(mj, "C");
      const player = await authenticate("player@test.com");
      await joinGroup(mj, campaign.groupId, player, "player@test.com");
      const sheet = await player
        .post("/character-sheets")
        .send({ name: "S", groupId: campaign.groupId });
      await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });

      const res = await mj.delete(`/campaigns/${campaign.body.id}/characters/${sheet.body.id}`);
      expect(res.status).toBe(204);
      expect(
        (await mj.get(`/campaigns/${campaign.body.id}/characters`)).body.characters,
      ).toHaveLength(0);
    });

    it("POST liaison sans cookie renvoie 401", async () => {
      const res = await request(app)
        .post("/campaigns/whatever/characters")
        .send({ characterSheetId: "x" });
      expect(res.status).toBe(401);
    });

    it("un non-MJ ne peut pas rattacher une fiche (403)", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await createCampaign(mj, "C");
      const player = await authenticate("player@test.com");
      await joinGroup(mj, campaign.groupId, player, "player@test.com");
      const sheet = await player
        .post("/character-sheets")
        .send({ name: "S", groupId: campaign.groupId });

      const res = await player
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("le propriétaire (non-MJ) ne peut pas détacher sa fiche (403)", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await createCampaign(mj, "C");
      const player = await authenticate("player@test.com");
      await joinGroup(mj, campaign.groupId, player, "player@test.com");
      const sheet = await player
        .post("/character-sheets")
        .send({ name: "S", groupId: campaign.groupId });
      await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });

      const res = await player.delete(`/campaigns/${campaign.body.id}/characters/${sheet.body.id}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("GET linkable-characters (MJ) liste les fiches des autres, exclut les siennes et les déjà liées", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await createCampaign(mj, "C");
      // une fiche au MJ (doit être exclue)
      await mj.post("/character-sheets").send({ name: "Fiche MJ", groupId: campaign.groupId });

      const player = await authenticate("player@test.com");
      await joinGroup(mj, campaign.groupId, player, "player@test.com");
      // une fiche libre du joueur (doit apparaître) + une déjà liée (doit être exclue)
      await player.post("/character-sheets").send({ name: "Libre", groupId: campaign.groupId });
      const linked = await player
        .post("/character-sheets")
        .send({ name: "Déjà liée", groupId: campaign.groupId });
      // le MJ rattache "linked" → elle ne doit plus être rattachable
      await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: linked.body.id });

      const res = await mj.get(`/campaigns/${campaign.body.id}/linkable-characters`);
      expect(res.status).toBe(200);
      const names = res.body.characters.map((c: { name: string }) => c.name);
      expect(names).toContain("Libre");
      expect(names).not.toContain("Fiche MJ");
      expect(names).not.toContain("Déjà liée");
    });

    it("GET linkable-characters par un non-MJ renvoie 403", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await createCampaign(mj, "C");
      const intrus = await authenticate("intrus@test.com");
      const res = await intrus.get(`/campaigns/${campaign.body.id}/linkable-characters`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("GET linkable-characters sans cookie renvoie 401", async () => {
      const res = await request(app).get("/campaigns/whatever/linkable-characters");
      expect(res.status).toBe(401);
    });
  });
});
