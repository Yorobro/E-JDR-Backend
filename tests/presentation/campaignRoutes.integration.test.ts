import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";

/**
 * Tests d'intégration HTTP des routes campaign.
 *
 * Montent la pile Express réelle (via {@link buildTestApp}) avec des doublures en mémoire.
 * L'authentification est réelle (middleware + cookies) : on s'inscrit d'abord pour obtenir
 * une session, puis on agit sur `/campaigns`. On valide les codes HTTP, l'usage de l'identité
 * de session comme MJ (jamais du corps), et le rejet d'un nom invalide ou d'un accès anonyme.
 */
describe("Campaign routes (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  /** Inscrit un utilisateur et renvoie un agent supertest conservant ses cookies de session. */
  async function authenticate(email = "mj@test.com"): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, password: "password123" });
    return agent;
  }

  it("POST /campaigns crée une campagne (201) pour l'utilisateur authentifié", async () => {
    const agent = await authenticate();

    const res = await agent.post("/campaigns").send({ name: "La Quête du Dragon" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "La Quête du Dragon" });
    expect(typeof res.body.id).toBe("string");
    expect(typeof res.body.createdAt).toBe("string");
  });

  it("GET /campaigns ne renvoie que les campagnes de l'utilisateur courant", async () => {
    const mj = await authenticate("mj@test.com");
    await mj.post("/campaigns").send({ name: "Alpha" });
    await mj.post("/campaigns").send({ name: "Beta" });

    // Un autre utilisateur, avec ses propres campagnes.
    const autre = await authenticate("autre@test.com");
    await autre.post("/campaigns").send({ name: "Gamma" });

    const res = await mj.get("/campaigns");

    expect(res.status).toBe(200);
    expect(res.body.campaigns).toHaveLength(2);
    expect(res.body.campaigns.map((c: { name: string }) => c.name).sort()).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("POST /campaigns avec un nom vide renvoie 400 (INVALID_CAMPAIGN_NAME)", async () => {
    const agent = await authenticate();

    const res = await agent.post("/campaigns").send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_CAMPAIGN_NAME");
  });

  it("POST /campaigns avec un corps vide renvoie 400 (sans 500)", async () => {
    const agent = await authenticate();

    const res = await agent.post("/campaigns").send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_CAMPAIGN_NAME");
  });

  it("POST /campaigns sans cookie renvoie 401 (UNAUTHENTICATED)", async () => {
    const res = await request(app).post("/campaigns").send({ name: "Anonyme" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("GET /campaigns sans cookie renvoie 401 (UNAUTHENTICATED)", async () => {
    const res = await request(app).get("/campaigns");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("DELETE /campaigns/:id supprime la campagne du propriétaire (204) puis elle disparaît", async () => {
    const agent = await authenticate();
    const created = await agent.post("/campaigns").send({ name: "À supprimer" });
    const id = created.body.id as string;

    const del = await agent.delete(`/campaigns/${id}`);
    expect(del.status).toBe(204);

    const list = await agent.get("/campaigns");
    expect(list.body.campaigns).toHaveLength(0);
  });

  it("DELETE /campaigns/:id renvoie 404 pour un id inconnu", async () => {
    const agent = await authenticate();

    const res = await agent.delete("/campaigns/inconnu");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CAMPAIGN_NOT_FOUND");
  });

  it("DELETE /campaigns/:id renvoie 403 si la campagne appartient à un autre MJ", async () => {
    const mj = await authenticate("mj@test.com");
    const created = await mj.post("/campaigns").send({ name: "Privée" });
    const id = created.body.id as string;

    const autre = await authenticate("autre@test.com");
    const res = await autre.delete(`/campaigns/${id}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CAMPAIGN_ACCESS_DENIED");

    // La campagne existe toujours pour son propriétaire.
    const list = await mj.get("/campaigns");
    expect(list.body.campaigns).toHaveLength(1);
  });

  it("DELETE /campaigns/:id sans cookie renvoie 401 (UNAUTHENTICATED)", async () => {
    const res = await request(app).delete("/campaigns/whatever");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});
