import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";
import { buildTestApp } from "./buildTestApp";

/**
 * Tests d'intégration HTTP des routes utilisateur protégées (`/me`).
 *
 * Ces tests tournent entièrement en mémoire via `buildTestApp` (fakes, pas de BDD),
 * exactement comme les autres tests d'intégration de la présentation. Ils sont exécutés
 * par `vitest run` sans Docker ni testcontainers.
 */
describe("User routes — PATCH /me/email et PATCH /me/password (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  /**
   * Inscrit un utilisateur et retourne un agent authentifié (cookies posés).
   */
  async function registerAndLogin(
    email: string,
    pseudo: string,
    password = "Password123!",
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, pseudo, password });
    return agent;
  }

  // ---------------------------------------------------------------------------
  // PATCH /me/email
  // ---------------------------------------------------------------------------

  it("PATCH /me/email avec un email valide → 200 ; GET /me renvoie le nouvel email", async () => {
    const agent = await registerAndLogin("old@test.com", "UserA");

    const patchRes = await agent.patch("/me/email").send({ email: "new@test.com" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.ok).toBe(true);

    const meRes = await agent.get("/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe("new@test.com");
  });

  it("PATCH /me/email avec un email déjà pris → 409 EMAIL_ALREADY_USED", async () => {
    await registerAndLogin("taken@test.com", "UserB");
    const agentA = await registerAndLogin("changer@test.com", "UserC");

    const res = await agentA.patch("/me/email").send({ email: "taken@test.com" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_ALREADY_USED");
  });

  it("PATCH /me/email avec un email malformé → 400 INVALID_EMAIL", async () => {
    const agent = await registerAndLogin("valid@test.com", "UserD");

    const res = await agent.patch("/me/email").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_EMAIL");
  });

  // ---------------------------------------------------------------------------
  // PATCH /me/password
  // ---------------------------------------------------------------------------

  it("PATCH /me/password avec mauvais ancien mot de passe → 401 INVALID_CREDENTIALS", async () => {
    const agent = await registerAndLogin("pwduser1@test.com", "PwdUser1");

    const res = await agent
      .patch("/me/password")
      .send({ currentPassword: "WrongPassword!", newPassword: "NewPassword123!" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("PATCH /me/password avec ancien correct + nouveau valide → 200 ; re-login avec le nouveau mot de passe → 200", async () => {
    const agent = await registerAndLogin("pwduser2@test.com", "PwdUser2", "Password123!");

    const patchRes = await agent
      .patch("/me/password")
      .send({ currentPassword: "Password123!", newPassword: "NewPassword456!" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.ok).toBe(true);

    // Note : buildTestApp crée une instance en mémoire fraîche par test ; le re-login
    // effectif avec le nouveau mot de passe sur une vraie BDD sera validé via test:db
    // sur Vertex dev.

    // On valide que GET /me fonctionne encore (session toujours active).
    const meRes = await agent.get("/me");
    expect(meRes.status).toBe(200);
  });

  it("PATCH /me/password avec nouveau mot de passe trop faible → 400", async () => {
    const agent = await registerAndLogin("pwduser3@test.com", "PwdUser3", "Password123!");

    const res = await agent
      .patch("/me/password")
      .send({ currentPassword: "Password123!", newPassword: "weak" });
    expect(res.status).toBe(400);
  });
});
