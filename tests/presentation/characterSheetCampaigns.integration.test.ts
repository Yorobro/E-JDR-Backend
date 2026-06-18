import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";

/**
 * Tests d'intégration HTTP de `GET /character-sheets/:id/campaigns` : pile Express réelle sur
 * doublures. Valide la projection (nom de campagne + pseudo du MJ) et l'autorisation propriétaire.
 */
describe("GET /character-sheets/:id/campaigns (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  /** Inscrit un utilisateur (avec son pseudo) et renvoie un agent conservant ses cookies. */
  async function authenticate(
    email: string,
    pseudo: string,
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, pseudo, password: "password123" });
    return agent;
  }

  /** Crée un groupe et renvoie son ID. */
  async function createGroup(
    agent: ReturnType<typeof request.agent>,
    name = "Mon groupe",
  ): Promise<string> {
    const res = await agent.post("/groups").send({ name });
    return res.body.id as string;
  }

  it("renvoie les campagnes rattachées à la fiche avec le pseudo du MJ (200)", async () => {
    const mj = await authenticate("mj@test.com", "MJ");
    const groupId = await createGroup(mj);
    const campaign = await mj.post("/campaigns").send({ name: "La campagne du MJ", groupId });

    const player = await authenticate("player@test.com", "Joueur");
    const sheet = await player.post("/character-sheets").send({ name: "Legolas" });

    // Seul le MJ peut rattacher la fiche d'un joueur à sa campagne.
    const link = await mj
      .post(`/campaigns/${campaign.body.id}/characters`)
      .send({ characterSheetId: sheet.body.id });
    expect(link.status).toBe(201);

    // Le propriétaire de la fiche (le joueur) consulte les campagnes rattachées.
    const res = await player.get(`/character-sheets/${sheet.body.id}/campaigns`);

    expect(res.status).toBe(200);
    expect(res.body.campaigns).toHaveLength(1);
    expect(res.body.campaigns[0].campaignId).toBe(campaign.body.id);
    expect(res.body.campaigns[0].campaignName).toBe("La campagne du MJ");
    expect(res.body.campaigns[0].gameMasterPseudo).toBe("MJ");
  });

  it("renvoie une liste vide si la fiche n'est rattachée à aucune campagne (200)", async () => {
    const player = await authenticate("player@test.com", "Joueur");
    const sheet = await player.post("/character-sheets").send({ name: "Gimli" });

    const res = await player.get(`/character-sheets/${sheet.body.id}/campaigns`);

    expect(res.status).toBe(200);
    expect(res.body.campaigns).toHaveLength(0);
  });

  it("renvoie 403 si le demandeur n'est pas le propriétaire de la fiche", async () => {
    const owner = await authenticate("owner@test.com", "Owner");
    const sheet = await owner.post("/character-sheets").send({ name: "Privée" });
    const intrus = await authenticate("intrus@test.com", "Intrus");

    const res = await intrus.get(`/character-sheets/${sheet.body.id}/campaigns`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
  });

  it("renvoie 404 pour une fiche inconnue", async () => {
    const player = await authenticate("player@test.com", "Joueur");
    const res = await player.get("/character-sheets/inconnu/campaigns");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CHARACTER_SHEET_NOT_FOUND");
  });

  it("renvoie 401 sans cookie de session", async () => {
    const res = await request(app).get("/character-sheets/whatever/campaigns");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});
