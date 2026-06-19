import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";
import { buildTestApp } from "./buildTestApp";

describe("Invitation routes (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  async function authenticate(
    email: string,
    pseudo: string,
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, pseudo, password: "password123" });
    return agent;
  }

  it("flux complet : inviter → lister → accepter", async () => {
    const agentA = await authenticate("a@test.com", "UserA");
    const agentB = await authenticate("b@test.com", "UserB");

    const created = await agentA.post("/groups").send({ name: "Mon Groupe" });
    const groupId = created.body.id;

    const invRes = await agentA
      .post(`/groups/${groupId}/invitations`)
      .send({ email: "b@test.com" });
    expect(invRes.status).toBe(201);
    expect(invRes.body.invitationId).toBeDefined();

    const listRes = await agentB.get("/invitations");
    expect(listRes.status).toBe(200);
    expect(listRes.body.invitations).toHaveLength(1);
    expect(listRes.body.invitations[0].groupId).toBe(groupId);

    const acceptRes = await agentB.post(`/invitations/${invRes.body.invitationId}/accept`);
    expect(acceptRes.status).toBe(200);

    const groupDetail = await agentB.get(`/groups/${groupId}`);
    expect(groupDetail.status).toBe(200);
    expect(groupDetail.body.members).toHaveLength(2);
    expect(groupDetail.body.myRole).toBe("MEMBER");
  });

  it("flux : inviter → refuser", async () => {
    const agentA = await authenticate("a2@test.com", "A2");
    const agentB = await authenticate("b2@test.com", "B2");

    const created = await agentA.post("/groups").send({ name: "Groupe Refus" });
    const invRes = await agentA
      .post(`/groups/${created.body.id}/invitations`)
      .send({ email: "b2@test.com" });

    const declineRes = await agentB.post(`/invitations/${invRes.body.invitationId}/decline`);
    expect(declineRes.status).toBe(200);

    const groupDetail = await agentB.get(`/groups/${created.body.id}`);
    expect(groupDetail.status).toBe(403);
  });

  it("POST /groups/:id/invitations avec email introuvable → 404", async () => {
    const agentA = await authenticate("a3@test.com", "A3");
    const created = await agentA.post("/groups").send({ name: "Groupe" });

    const res = await agentA
      .post(`/groups/${created.body.id}/invitations`)
      .send({ email: "inexistant@test.com" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("INVITED_USER_NOT_FOUND");
  });

  it("POST /invitations/:id/accept deux fois → 409 INVITATION_ALREADY_RESOLVED", async () => {
    const agentA = await authenticate("a4@test.com", "A4");
    const agentB = await authenticate("b4@test.com", "B4");

    const created = await agentA.post("/groups").send({ name: "Groupe" });
    const invRes = await agentA
      .post(`/groups/${created.body.id}/invitations`)
      .send({ email: "b4@test.com" });

    await agentB.post(`/invitations/${invRes.body.invitationId}/accept`);
    const res = await agentB.post(`/invitations/${invRes.body.invitationId}/accept`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVITATION_ALREADY_RESOLVED");
  });
});
