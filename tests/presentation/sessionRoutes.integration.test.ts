import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";

/**
 * Tests d'intégration HTTP des routes session.
 *
 * Montent la pile Express réelle (via {@link buildTestApp}) avec des doublures en mémoire.
 * L'authentification est réelle : on s'inscrit pour obtenir une session, on crée une campagne,
 * puis on agit sur `/campaigns/:id/sessions` et `/sessions/:id`. On valide les codes HTTP,
 * l'autorisation MJ (toujours déduite de la session), et les validations titre/date.
 */
describe("Session routes (intégration HTTP)", () => {
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

  /** Crée une campagne via l'agent donné et renvoie son id. */
  async function createCampaign(
    agent: ReturnType<typeof request.agent>,
    name = "Campagne",
  ): Promise<string> {
    const res = await agent.post("/campaigns").send({ name });
    return res.body.id as string;
  }

  it("POST /campaigns/:id/sessions crée une session (201) pour le MJ", async () => {
    const mj = await authenticate();
    const campaignId = await createCampaign(mj);

    const res = await mj
      .post(`/campaigns/${campaignId}/sessions`)
      .send({ title: "Le réveil du dragon", date: "2026-06-20" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      campaignId,
      title: "Le réveil du dragon",
      date: "2026-06-20",
    });
    expect(typeof res.body.id).toBe("string");
  });

  it("GET /campaigns/:id/sessions liste les sessions de la campagne (plus récentes d'abord)", async () => {
    const mj = await authenticate();
    const campaignId = await createCampaign(mj);
    await mj
      .post(`/campaigns/${campaignId}/sessions`)
      .send({ title: "Ancienne", date: "2026-01-10" });
    await mj
      .post(`/campaigns/${campaignId}/sessions`)
      .send({ title: "Récente", date: "2026-06-20" });

    const res = await mj.get(`/campaigns/${campaignId}/sessions`);

    expect(res.status).toBe(200);
    expect(res.body.sessions.map((s: { title: string }) => s.title)).toEqual([
      "Récente",
      "Ancienne",
    ]);
  });

  it("POST session avec un titre vide renvoie 400 (INVALID_SESSION_TITLE)", async () => {
    const mj = await authenticate();
    const campaignId = await createCampaign(mj);

    const res = await mj
      .post(`/campaigns/${campaignId}/sessions`)
      .send({ title: "  ", date: "2026-06-20" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_SESSION_TITLE");
  });

  it("POST session avec une date mal formée renvoie 400 (INVALID_SESSION_DATE)", async () => {
    const mj = await authenticate();
    const campaignId = await createCampaign(mj);

    const res = await mj
      .post(`/campaigns/${campaignId}/sessions`)
      .send({ title: "Session", date: "20/06/2026" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_SESSION_DATE");
  });

  it("POST session sur une campagne d'un autre MJ renvoie 403 (CAMPAIGN_ACCESS_DENIED)", async () => {
    const mj = await authenticate("mj@test.com");
    const campaignId = await createCampaign(mj);

    const autre = await authenticate("autre@test.com");
    const res = await autre
      .post(`/campaigns/${campaignId}/sessions`)
      .send({ title: "Intrus", date: "2026-06-20" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CAMPAIGN_ACCESS_DENIED");
  });

  it("GET/PUT/DELETE /sessions/:id : cycle de vie complet pour le MJ", async () => {
    const mj = await authenticate();
    const campaignId = await createCampaign(mj);
    const created = await mj
      .post(`/campaigns/${campaignId}/sessions`)
      .send({ title: "Avant", date: "2026-06-20" });
    const sessionId = created.body.id as string;

    // GET détail
    const got = await mj.get(`/sessions/${sessionId}`);
    expect(got.status).toBe(200);
    expect(got.body.title).toBe("Avant");

    // PUT met à jour
    const put = await mj.put(`/sessions/${sessionId}`).send({ title: "Après", date: "2026-07-01" });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ title: "Après", date: "2026-07-01" });

    // DELETE
    const del = await mj.delete(`/sessions/${sessionId}`);
    expect(del.status).toBe(204);

    const list = await mj.get(`/campaigns/${campaignId}/sessions`);
    expect(list.body.sessions).toHaveLength(0);
  });

  it("GET /sessions/:id inconnu renvoie 404 (SESSION_NOT_FOUND)", async () => {
    const mj = await authenticate();
    const res = await mj.get("/sessions/inconnu");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("SESSION_NOT_FOUND");
  });

  it("GET /sessions/:id d'une campagne d'un autre MJ renvoie 403", async () => {
    const mj = await authenticate("mj@test.com");
    const campaignId = await createCampaign(mj);
    const created = await mj
      .post(`/campaigns/${campaignId}/sessions`)
      .send({ title: "Privée", date: "2026-06-20" });
    const sessionId = created.body.id as string;

    const autre = await authenticate("autre@test.com");
    const res = await autre.get(`/sessions/${sessionId}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CAMPAIGN_ACCESS_DENIED");
  });

  it("POST session sans cookie renvoie 401 (UNAUTHENTICATED)", async () => {
    const res = await request(app)
      .post("/campaigns/whatever/sessions")
      .send({ title: "Anonyme", date: "2026-06-20" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});
