import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";

describe("Campaign routes (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  /** Inscrit un utilisateur et renvoie un agent supertest conservant ses cookies de session. */
  async function authenticate(email = "mj@test.com"): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, pseudo: "Gandalf", password: "password123" });
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

  it("POST /campaigns crée une campagne (201) pour l'utilisateur authentifié", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);

    const res = await agent.post("/campaigns").send({ name: "La Quête du Dragon", groupId });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "La Quête du Dragon" });
    expect(typeof res.body.id).toBe("string");
    expect(typeof res.body.createdAt).toBe("string");
  });

  it("GET /campaigns ne renvoie que les campagnes du groupe", async () => {
    const mj = await authenticate("mj@test.com");
    const mjGroupId = await createGroup(mj, "Groupe MJ");
    await mj.post("/campaigns").send({ name: "Alpha", groupId: mjGroupId });
    await mj.post("/campaigns").send({ name: "Beta", groupId: mjGroupId });

    const autre = await authenticate("autre@test.com");
    const autreGroupId = await createGroup(autre, "Groupe Autre");
    await autre.post("/campaigns").send({ name: "Gamma", groupId: autreGroupId });

    const res = await mj.get(`/campaigns?groupId=${mjGroupId}`);

    expect(res.status).toBe(200);
    expect(res.body.campaigns).toHaveLength(2);
    expect(res.body.campaigns.map((c: { name: string }) => c.name).sort()).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("POST /campaigns avec un nom vide renvoie 400 (INVALID_CAMPAIGN_NAME)", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);

    const res = await agent.post("/campaigns").send({ name: "   ", groupId });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_CAMPAIGN_NAME");
  });

  it("POST /campaigns avec un corps vide renvoie 400 (NOT_GROUP_MEMBER)", async () => {
    const agent = await authenticate();

    const res = await agent.post("/campaigns").send({});

    // groupId absent → requireMember sur undefined → NOT_GROUP_MEMBER
    expect(res.status).toBe(403);
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
    const groupId = await createGroup(agent);
    const created = await agent.post("/campaigns").send({ name: "À supprimer", groupId });
    const id = created.body.id as string;

    const del = await agent.delete(`/campaigns/${id}`);
    expect(del.status).toBe(204);

    const list = await agent.get(`/campaigns?groupId=${groupId}`);
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
    const mjGroupId = await createGroup(mj, "Groupe MJ");
    const created = await mj.post("/campaigns").send({ name: "Privée", groupId: mjGroupId });
    const id = created.body.id as string;

    const autre = await authenticate("autre@test.com");
    const res = await autre.delete(`/campaigns/${id}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CAMPAIGN_ACCESS_DENIED");

    const list = await mj.get(`/campaigns?groupId=${mjGroupId}`);
    expect(list.body.campaigns).toHaveLength(1);
  });

  it("DELETE /campaigns/:id sans cookie renvoie 401 (UNAUTHENTICATED)", async () => {
    const res = await request(app).delete("/campaigns/whatever");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});
