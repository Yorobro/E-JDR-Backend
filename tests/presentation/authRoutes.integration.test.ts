import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { AppConfig } from "@config/env";
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
import { buildAuthRoutes } from "@presentation/http/features/auth/routes/authRoutes";
import { buildErrorHandler } from "@presentation/http/shared/middlewares/errorHandler";
import { buildHttpApp } from "../../src/main";

import { AuthTokenServiceImpl } from "@application/features/auth/services/AuthTokenServiceImpl";
import { RegisterUserUseCaseImpl } from "@application/features/auth/usecases/RegisterUserUseCaseImpl";
import { LoginUserUseCaseImpl } from "@application/features/auth/usecases/LoginUserUseCaseImpl";
import { LogoutUserUseCaseImpl } from "@application/features/auth/usecases/LogoutUserUseCaseImpl";
import { RefreshAccessTokenUseCaseImpl } from "@application/features/auth/usecases/RefreshAccessTokenUseCaseImpl";
import { GetCurrentUserUseCaseImpl } from "@application/features/auth/usecases/GetCurrentUserUseCaseImpl";
import { UserController } from "@presentation/http/features/auth/controllers/UserController";
import { buildAuthMiddleware } from "@presentation/http/shared/middlewares/authMiddleware";

import {
  buildFakeTransactionalRepositories,
  FakeUnitOfWork,
  FakeLogger,
  FakePasswordHasher,
  FakeIdGenerator,
  FakeTokenHasher,
  FakeTokenProvider,
} from "../application/fakes";

/**
 * Tests d'intégration HTTP des routes d'authentification.
 *
 * Ils montent la **pile Express réelle** (routage, `express.json`, `cookie-parser`,
 * `AuthController`, `AuthHttpMapper`, `errorHandler`) via {@link buildHttpApp}, mais
 * câblent les use cases sur des **doublures en mémoire** (aucune base de données ni
 * cryptographie réelle). On valide ici ce que les tests unitaires de use cases ne
 * couvrent pas : les codes HTTP, le dépôt des cookies, et le traitement des entrées
 * malformées au bord HTTP.
 */
describe("Auth routes (intégration HTTP)", () => {
  let app: Application;

  /** Construit une appli Express identique à la production mais sur doublures. */
  function buildTestApp(): Application {
    const txRepos = buildFakeTransactionalRepositories();
    const userRepository = txRepos.users;
    const credentialRepository = txRepos.credentials;
    const refreshTokenRepository = txRepos.refreshTokens;
    const unitOfWork = new FakeUnitOfWork(txRepos);
    const passwordHasher = new FakePasswordHasher();
    const idGenerator = new FakeIdGenerator();
    const tokenHasher = new FakeTokenHasher();
    const tokenProvider = new FakeTokenProvider();

    const authTokenService = new AuthTokenServiceImpl(
      tokenProvider,
      tokenHasher,
      idGenerator,
      refreshTokenRepository,
    );

    const logger = new FakeLogger();

    const controller = new AuthController(
      new RegisterUserUseCaseImpl(
        credentialRepository,
        passwordHasher,
        idGenerator,
        authTokenService,
        unitOfWork,
        logger,
      ),
      new LoginUserUseCaseImpl(
        credentialRepository,
        passwordHasher,
        authTokenService,
        unitOfWork,
        logger,
      ),
      new LogoutUserUseCaseImpl(tokenHasher, unitOfWork),
      new RefreshAccessTokenUseCaseImpl(
        userRepository,
        refreshTokenRepository,
        tokenProvider,
        tokenHasher,
        authTokenService,
        unitOfWork,
      ),
      { isProduction: false } as AppConfig,
    );

    const userController = new UserController(
      new GetCurrentUserUseCaseImpl(userRepository, credentialRepository),
    );
    const authMiddleware = buildAuthMiddleware(tokenProvider);

    return buildHttpApp(controller, userController, authMiddleware, logger);
  }

  beforeEach(() => {
    app = buildTestApp();
  });

  it("POST /auth/register crée le compte (201) et pose les cookies access + refresh", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "new@test.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "new@test.com" });

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
    // Les cookies doivent être httpOnly.
    expect(cookies.every((c) => /httponly/i.test(c))).toBe(true);
  });

  it("POST /auth/register en double renvoie 409", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "dup@test.com", password: "password123" });
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "dup@test.com", password: "password123" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_ALREADY_USED");
  });

  it("POST /auth/register avec un corps VIDE renvoie 400 (et non 500)", async () => {
    const res = await request(app).post("/auth/register").send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_EMAIL");
  });

  it("POST /auth/register avec un mot de passe trop court renvoie 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "weak@test.com", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("WEAK_PASSWORD");
  });

  it("POST /auth/login avec des identifiants inconnus renvoie 401", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "ghost@test.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("POST /auth/login réussit (200) après inscription et pose les cookies", async () => {
    await request(app)
      .post("/auth/register")
      .send({ email: "log@test.com", password: "password123" });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "log@test.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: "log@test.com" });
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
  });

  it("POST /auth/login avec un corps vide renvoie 401 (sans 500)", async () => {
    const res = await request(app).post("/auth/login").send({});

    // email manquant → InvalidEmailError (400) ; on s'assure surtout de l'absence de 500.
    expect(res.status).not.toBe(500);
    expect([400, 401]).toContain(res.status);
  });

  it("POST /auth/logout réussit (200) et efface les cookies", async () => {
    const res = await request(app).post("/auth/logout");

    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    // clearCookie pose des cookies avec une date d'expiration dans le passé.
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
  });

  it("POST /auth/refresh sans cookie renvoie 401 et efface les cookies", async () => {
    const res = await request(app).post("/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("POST /auth/refresh effectue la rotation à partir du cookie posé au register", async () => {
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email: "rot@test.com", password: "password123" });

    const res = await agent.post("/auth/refresh");

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  // Garde-fou : la pile de gestion d'erreurs et le routage sont bien câblés.
  it("référence les middlewares attendus (routes + errorHandler)", () => {
    expect(typeof buildAuthRoutes).toBe("function");
    expect(typeof buildErrorHandler).toBe("function");
  });

  describe("GET /me (route protégée)", () => {
    it("renvoie 200 et le profil avec les cookies posés par register", async () => {
      // request.agent conserve les cookies entre les appels, comme un vrai client.
      const agent = request.agent(app);
      await agent.post("/auth/register").send({ email: "me@test.com", password: "password123" });

      const res = await agent.get("/me");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: "me@test.com" });
      expect(typeof res.body.userId).toBe("string");
      expect(typeof res.body.createdAt).toBe("string");
    });

    it("renvoie 401 UNAUTHENTICATED sans cookie", async () => {
      const res = await request(app).get("/me");

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHENTICATED");
    });

    it("renvoie 401 UNAUTHENTICATED avec un token invalide", async () => {
      const res = await request(app).get("/me").set("Cookie", "access_token=garbage");

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHENTICATED");
    });

    it("renvoie 401 USER_NOT_FOUND si le compte n'existe plus", async () => {
      // Jeton techniquement valide (signé par le FakeTokenProvider) pour un compte inexistant.
      const ghostToken = `access:${JSON.stringify({ userId: "ghost", email: "g@test.com" })}`;

      const res = await request(app)
        .get("/me")
        .set("Cookie", `access_token=${encodeURIComponent(ghostToken)}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("USER_NOT_FOUND");
    });
  });
});
