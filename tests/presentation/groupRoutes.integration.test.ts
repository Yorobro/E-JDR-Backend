import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";
import { buildTestApp } from "./buildTestApp";

describe("Group routes (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  async function authenticate(
    email = "user@test.com",
    pseudo = "Utilisateur",
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, pseudo, password: "password123" });
    return agent;
  }

  it("POST /groups crée un groupe (201) avec le créateur ADMIN", async () => {
    const agent = await authenticate();

    const res = await agent.post("/groups").send({ name: "Les Aventuriers" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Les Aventuriers", myRole: "ADMIN" });
    expect(res.body.id).toBeDefined();
  });

  it("POST /groups avec un nom vide renvoie 400 (INVALID_GROUP_NAME)", async () => {
    const agent = await authenticate();

    const res = await agent.post("/groups").send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_GROUP_NAME");
  });

  it("GET /groups liste les groupes de l'utilisateur", async () => {
    const agent = await authenticate();
    await agent.post("/groups").send({ name: "Groupe A" });
    await agent.post("/groups").send({ name: "Groupe B" });

    const res = await agent.get("/groups");

    expect(res.status).toBe(200);
    expect(res.body.groups).toHaveLength(2);
  });

  it("GET /groups/:id retourne le détail du groupe (membres inclus)", async () => {
    const agent = await authenticate();
    const created = await agent.post("/groups").send({ name: "Mon Groupe" });

    const res = await agent.get(`/groups/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Mon Groupe");
    expect(res.body.myRole).toBe("ADMIN");
    expect(res.body.members).toHaveLength(1);
  });

  it("GET /groups/:id sans être membre renvoie 403", async () => {
    const agentA = await authenticate("a@test.com", "A");
    const agentB = await authenticate("b@test.com", "B");

    const created = await agentA.post("/groups").send({ name: "Groupe Privé" });

    const res = await agentB.get(`/groups/${created.body.id}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NOT_GROUP_MEMBER");
  });

  it("DELETE /groups/:id supprime un groupe (204, admin uniquement)", async () => {
    const agent = await authenticate();
    const created = await agent.post("/groups").send({ name: "À supprimer" });

    const res = await agent.delete(`/groups/${created.body.id}`);

    expect(res.status).toBe(204);
  });

  it("DELETE /groups/:id sans être admin renvoie 403", async () => {
    const agentA = await authenticate("a@test.com", "A");
    const agentB = await authenticate("b@test.com", "B");

    const created = await agentA.post("/groups").send({ name: "Groupe" });

    const res = await agentB.delete(`/groups/${created.body.id}`);

    expect(res.status).toBe(403);
  });

  it("POST /groups sans token renvoie 401", async () => {
    const res = await request(app).post("/groups").send({ name: "Groupe" });
    expect(res.status).toBe(401);
  });
});
