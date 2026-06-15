import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";

/**
 * Tests d'intégration HTTP des routes fiches (`/character-sheets`) et de la liaison
 * campagne↔fiches (`/campaigns/:id/characters`), pile Express réelle sur doublures.
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

  describe("CRUD fiches", () => {
    it("POST /character-sheets crée une fiche (201)", async () => {
      const agent = await authenticate("p@test.com");
      const res = await agent.post("/character-sheets").send({ name: "Aragorn" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: "Aragorn" });
      expect(typeof res.body.id).toBe("string");
      // Le contrat doit être homogène avec GET /character-sheets : ownerId présent
      // (sinon le DTO front, qui l'exige, échoue à parser la réponse → fausse "erreur réseau").
      expect(typeof res.body.ownerId).toBe("string");
    });

    it("GET /character-sheets ne renvoie que mes fiches", async () => {
      const me = await authenticate("me@test.com");
      await me.post("/character-sheets").send({ name: "Une" });
      await me.post("/character-sheets").send({ name: "Deux" });
      const other = await authenticate("other@test.com");
      await other.post("/character-sheets").send({ name: "Autre" });

      const res = await me.get("/character-sheets");
      expect(res.status).toBe(200);
      expect(res.body.characterSheets).toHaveLength(2);
    });

    it("POST /character-sheets avec un nom vide renvoie 400", async () => {
      const agent = await authenticate("p@test.com");
      const res = await agent.post("/character-sheets").send({ name: "   " });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_CHARACTER_SHEET_NAME");
    });

    it("DELETE /character-sheets/:id supprime ma fiche (204)", async () => {
      const agent = await authenticate("p@test.com");
      const created = await agent.post("/character-sheets").send({ name: "À supprimer" });
      const res = await agent.delete(`/character-sheets/${created.body.id}`);
      expect(res.status).toBe(204);
      expect((await agent.get("/character-sheets")).body.characterSheets).toHaveLength(0);
    });

    it("DELETE la fiche d'un autre renvoie 403", async () => {
      const owner = await authenticate("owner@test.com");
      const created = await owner.post("/character-sheets").send({ name: "Privée" });
      const intrus = await authenticate("intrus@test.com");
      const res = await intrus.delete(`/character-sheets/${created.body.id}`);
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
      const created = await agent.post("/character-sheets").send({ name: "Aragorn" });

      const res = await agent.get(`/character-sheets/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: created.body.id, name: "Aragorn" });
      // Les champs détaillés sont présents et null à la création.
      expect(res.body.peuple).toBeNull();
      expect(res.body.vigueur).toBeNull();
      expect(res.body.notes).toBeNull();
    });

    it("PUT /character-sheets/:id met à jour la fiche, GET reflète les changements", async () => {
      const agent = await authenticate("p@test.com");
      const created = await agent.post("/character-sheets").send({ name: "Aragorn" });

      const put = await agent.put(`/character-sheets/${created.body.id}`).send({
        name: "Strider",
        peuple: "Rôdeur",
        niveau: 5,
        age: 87,
        sexe: "M",
        competences: "Pistage",
        vigueur: 7,
        notes: "Garde du Nord",
        purse: { gold: 1, silver: 50, copper: 0 },
      });
      expect(put.status).toBe(200);
      expect(put.body).toMatchObject({ name: "Strider", peuple: "Rôdeur", niveau: 5, sexe: "M" });
      expect(put.body.purse).toEqual({ gold: 1, silver: 50, copper: 0 });

      const res = await agent.get(`/character-sheets/${created.body.id}`);
      expect(res.body.name).toBe("Strider");
      expect(res.body.vigueur).toBe(7);
      expect(res.body.competences).toBe("Pistage");
      expect(res.body.purse).toEqual({ gold: 1, silver: 50, copper: 0 });
    });

    it("PUT avec un sexe invalide renvoie 400", async () => {
      const agent = await authenticate("p@test.com");
      const created = await agent.post("/character-sheets").send({ name: "Aragorn" });

      const res = await agent
        .put(`/character-sheets/${created.body.id}`)
        .send({ name: "A", sexe: "Z" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_SEX");
    });

    it("PUT avec un nom vide renvoie 400", async () => {
      const agent = await authenticate("p@test.com");
      const created = await agent.post("/character-sheets").send({ name: "Aragorn" });

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

    it("GET la fiche d'un autre renvoie 403", async () => {
      const owner = await authenticate("owner@test.com");
      const created = await owner.post("/character-sheets").send({ name: "Privée" });
      const intrus = await authenticate("intrus@test.com");

      const res = await intrus.get(`/character-sheets/${created.body.id}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("PUT la fiche d'un autre renvoie 403", async () => {
      const owner = await authenticate("owner@test.com");
      const created = await owner.post("/character-sheets").send({ name: "Privée" });
      const intrus = await authenticate("intrus@test.com");

      const res = await intrus.put(`/character-sheets/${created.body.id}`).send({ name: "Hack" });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("GET /character-sheets/:id sans cookie renvoie 401", async () => {
      const res = await request(app).get("/character-sheets/whatever");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHENTICATED");
    });
  });

  describe("Liaison campagne↔fiches", () => {
    it("rattache la fiche d'un joueur à la campagne d'un MJ (201) puis la liste", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await mj.post("/campaigns").send({ name: "Ma campagne" });

      const player = await authenticate("player@test.com");
      const sheet = await player.post("/character-sheets").send({ name: "Legolas" });

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
      const campaign = await mj.post("/campaigns").send({ name: "Ma campagne" });
      const sheet = await mj.post("/character-sheets").send({ name: "Fiche du MJ" });

      const res = await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("GM_CANNOT_JOIN_OWN_CAMPAIGN");
    });

    it("refuse (409) un rattachement en double", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await mj.post("/campaigns").send({ name: "C" });
      const player = await authenticate("player@test.com");
      const sheet = await player.post("/character-sheets").send({ name: "S" });

      await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });
      const dup = await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });

      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe("SHEET_ALREADY_IN_CAMPAIGN");
    });

    it("détache une fiche (204)", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await mj.post("/campaigns").send({ name: "C" });
      const player = await authenticate("player@test.com");
      const sheet = await player.post("/character-sheets").send({ name: "S" });
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
      const campaign = await mj.post("/campaigns").send({ name: "C" });
      const player = await authenticate("player@test.com");
      const sheet = await player.post("/character-sheets").send({ name: "S" });

      const res = await player
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("le propriétaire (non-MJ) ne peut pas détacher sa fiche (403)", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await mj.post("/campaigns").send({ name: "C" });
      const player = await authenticate("player@test.com");
      const sheet = await player.post("/character-sheets").send({ name: "S" });
      await mj
        .post(`/campaigns/${campaign.body.id}/characters`)
        .send({ characterSheetId: sheet.body.id });

      const res = await player.delete(`/campaigns/${campaign.body.id}/characters/${sheet.body.id}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("GET linkable-characters (MJ) liste les fiches des autres, exclut les siennes et les déjà liées", async () => {
      const mj = await authenticate("mj@test.com");
      const campaign = await mj.post("/campaigns").send({ name: "C" });
      // une fiche au MJ (doit être exclue)
      await mj.post("/character-sheets").send({ name: "Fiche MJ" });

      const player = await authenticate("player@test.com");
      // une fiche libre du joueur (doit apparaître) + une déjà liée (doit être exclue)
      await player.post("/character-sheets").send({ name: "Libre" });
      const linked = await player.post("/character-sheets").send({ name: "Déjà liée" });
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
      const campaign = await mj.post("/campaigns").send({ name: "C" });
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
