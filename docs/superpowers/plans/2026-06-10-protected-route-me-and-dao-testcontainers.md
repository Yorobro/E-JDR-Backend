# Route protégée GET /me + tests d'intégration DAO (Testcontainers) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer la première route protégée `GET /me` (middleware JWT + use case `GetCurrentUser`) et valider les DAO contre un MySQL réel via Testcontainers.

**Architecture:** Clean Architecture 4 couches existante. Le middleware vit en présentation et s'appuie sur le port `ITokenProvider` existant ; le use case est en lecture seule (pas d'UnitOfWork) ; les tests DB utilisent un conteneur `mysql:8.4` jetable migré par les migrations Umzug réelles, via une config Vitest séparée (`npm run test:db`).

**Tech Stack:** Express 4, TypeScript strict, Vitest 3, supertest, mysql2, Umzug, `@testcontainers/mysql`.

**Spec :** `docs/superpowers/specs/2026-06-10-protected-route-me-and-dao-testcontainers-design.md`

**Conventions du repo à respecter partout :**
- Commentaires JSDoc en français sur chaque classe/méthode publique (voir fichiers existants).
- Erreurs métier = `Result<T, E>` (jamais d'exception pour un échec attendu).
- Alias d'imports : `@domain/*`, `@application/*`, `@infrastructure/*`, `@presentation/*`, `@config/*`.
- Commits : Conventional Commits (`feat(...)`, `test(...)`, `chore(...)`), validés par commitlint.
- Avant chaque commit : `npm run lint` et `npm run format` doivent passer.

---

### Task 1: Use case `GetCurrentUser` + port `findByUserId`

**Files:**
- Create: `src/application/auth/errors/UserNotFoundError.ts`
- Create: `src/application/auth/commands/GetCurrentUserQuery.ts`
- Create: `src/application/auth/abstractions/usecases/IGetCurrentUserUseCase.ts`
- Create: `src/application/auth/usecases/GetCurrentUserUseCase.ts`
- Modify: `src/application/auth/abstractions/repositories/ICredentialRepository.ts` (ajouter `findByUserId`)
- Modify: `tests/application/fakes.ts` (ajouter `findByUserId` au `FakeCredentialRepository`)
- Modify: `src/infrastructure/persistence/mysql/auth/dao/CredentialDao.ts` (ajouter `findByUserId`)
- Modify: `src/infrastructure/persistence/mysql/auth/repository/MysqlCredentialRepository.ts` (ajouter `findByUserId`)
- Test: `tests/application/GetCurrentUserUseCase.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/application/GetCurrentUserUseCase.test.ts` :

```typescript
import { describe, it, expect } from "vitest";

import { GetCurrentUserUseCase } from "@application/auth/usecases/GetCurrentUserUseCase";
import { UserNotFoundError } from "@application/auth/errors/UserNotFoundError";

import {
  FakeUserRepository,
  FakeCredentialRepository,
  buildTestUser,
  buildTestCredential,
} from "./fakes";

describe("GetCurrentUserUseCase", () => {
  function buildUseCase() {
    const users = new FakeUserRepository();
    const credentials = new FakeCredentialRepository();
    return { useCase: new GetCurrentUserUseCase(users, credentials), users, credentials };
  }

  it("renvoie le profil quand l'utilisateur et son credential existent", async () => {
    const { useCase, users, credentials } = buildUseCase();
    users.seed(buildTestUser("user-1"));
    credentials.seed(buildTestCredential("me@test.com", "password123", "user-1"));

    const result = await useCase.execute({ userId: "user-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({
      userId: "user-1",
      email: "me@test.com",
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
  });

  it("échoue avec UserNotFoundError quand l'utilisateur n'existe pas", async () => {
    const { useCase } = buildUseCase();

    const result = await useCase.execute({ userId: "ghost" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(UserNotFoundError);
    expect(result.error.code).toBe("USER_NOT_FOUND");
  });

  it("échoue avec UserNotFoundError quand le credential n'existe pas", async () => {
    const { useCase, users } = buildUseCase();
    users.seed(buildTestUser("user-1"));

    const result = await useCase.execute({ userId: "user-1" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(UserNotFoundError);
  });
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/application/GetCurrentUserUseCase.test.ts`
Expected: FAIL — `Cannot find module '@application/auth/usecases/GetCurrentUserUseCase'`

- [ ] **Step 3: Créer l'erreur, la query et l'interface du use case**

`src/application/auth/errors/UserNotFoundError.ts` :

```typescript
import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'un utilisateur référencé par un jeton valide
 * n'existe plus en base (ex : compte supprimé après l'émission du jeton).
 *
 * Traduite en `401 Unauthorized` par la couche présentation : du point de vue du
 * client, la session n'est plus valide et il doit se déconnecter.
 */
export class UserNotFoundError extends AppError {
  constructor() {
    super("USER_NOT_FOUND", "Utilisateur introuvable.");
  }
}
```

`src/application/auth/commands/GetCurrentUserQuery.ts` :

```typescript
/**
 * Données d'entrée du use case de consultation du profil courant.
 *
 * Le `userId` provient des claims du jeton d'accès vérifié par le middleware
 * d'authentification — jamais du corps de la requête.
 */
export interface GetCurrentUserQuery {
  /** Identifiant de l'utilisateur authentifié. */
  readonly userId: string;
}
```

`src/application/auth/abstractions/usecases/IGetCurrentUserUseCase.ts` :

```typescript
import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { GetCurrentUserQuery } from "@application/auth/commands/GetCurrentUserQuery";

/**
 * Profil de l'utilisateur courant renvoyé par le use case.
 */
export interface CurrentUserResult {
  /** Identifiant de l'utilisateur. */
  readonly userId: string;
  /** Adresse e-mail du compte. */
  readonly email: string;
  /** Date de création du compte. */
  readonly createdAt: Date;
}

/**
 * Port d'entrée du use case de consultation du profil courant (`GET /me`).
 */
export interface IGetCurrentUserUseCase {
  /**
   * Récupère le profil de l'utilisateur authentifié.
   *
   * @param query - L'identifiant issu du jeton d'accès vérifié.
   * @returns Le profil, ou `UserNotFoundError` si le compte n'existe plus.
   */
  execute(query: GetCurrentUserQuery): Promise<Result<CurrentUserResult, AppError>>;
}
```

- [ ] **Step 4: Ajouter `findByUserId` au port `ICredentialRepository`**

Dans `src/application/auth/abstractions/repositories/ICredentialRepository.ts`, ajouter à l'interface (après `findByEmail`) :

```typescript
  /**
   * Recherche un identifiant d'authentification par l'utilisateur auquel il est rattaché.
   *
   * @param userId - L'identifiant de l'utilisateur (relation 1–1 avec `Credential`).
   * @returns Le `Credential` correspondant, ou `null` s'il n'existe pas.
   */
  findByUserId(userId: string): Promise<Credential | null>;
```

- [ ] **Step 5: Implémenter `findByUserId` dans le fake**

Dans `tests/application/fakes.ts`, classe `FakeCredentialRepository`, ajouter (après `findByEmail`) :

```typescript
  public async findByUserId(userId: string): Promise<Credential | null> {
    for (const credential of this.credentials.values()) {
      if (credential.userId === userId) {
        return credential;
      }
    }
    return null;
  }
```

- [ ] **Step 6: Implémenter le use case**

`src/application/auth/usecases/GetCurrentUserUseCase.ts` :

```typescript
import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { UserNotFoundError } from "@application/auth/errors/UserNotFoundError";
import { GetCurrentUserQuery } from "@application/auth/commands/GetCurrentUserQuery";
import {
  CurrentUserResult,
  IGetCurrentUserUseCase,
} from "@application/auth/abstractions/usecases/IGetCurrentUserUseCase";
import { IUserRepository } from "@application/auth/abstractions/repositories/IUserRepository";
import { ICredentialRepository } from "@application/auth/abstractions/repositories/ICredentialRepository";

/**
 * Use case de consultation du profil de l'utilisateur courant.
 *
 * Orchestration pure en **lecture seule** : pas d'UnitOfWork (réservé aux écritures).
 * Le `userId` provient du jeton vérifié en amont ; si l'utilisateur ou son credential
 * a disparu entre-temps (compte supprimé), la session est considérée invalide.
 */
export class GetCurrentUserUseCase implements IGetCurrentUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly credentialRepository: ICredentialRepository,
  ) {}

  public async execute(
    query: GetCurrentUserQuery,
  ): Promise<Result<CurrentUserResult, AppError>> {
    const user = await this.userRepository.findById(query.userId);
    if (user === null) {
      return Result.failure(new UserNotFoundError());
    }

    const credential = await this.credentialRepository.findByUserId(query.userId);
    if (credential === null) {
      return Result.failure(new UserNotFoundError());
    }

    return Result.success({
      userId: user.id,
      email: credential.email.value,
      createdAt: user.createdAt,
    });
  }
}
```

- [ ] **Step 7: Implémenter `findByUserId` côté MySQL (DAO + repository)**

Dans `src/infrastructure/persistence/mysql/auth/dao/CredentialDao.ts`, ajouter (après `findByEmail`) :

```typescript
  public async findByUserId(userId: string): Promise<CredentialRow | null> {
    const [rows] = await this.executor.execute<CredentialRow[]>(
      `SELECT id, user_id, email, password_hash, created_at, failed_attempts, locked_until
       FROM credentials WHERE user_id = ? LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
  }
```

Dans `src/infrastructure/persistence/mysql/auth/repository/MysqlCredentialRepository.ts`, ajouter (après `findByEmail`) :

```typescript
  /**
   * @inheritdoc
   */
  public async findByUserId(userId: string): Promise<Credential | null> {
    const row = await this.credentialDao.findByUserId(userId);
    return row === null ? null : CredentialMapper.toDomain(row);
  }
```

- [ ] **Step 8: Vérifier que les tests passent**

Run: `npx vitest run tests/application/GetCurrentUserUseCase.test.ts`
Expected: PASS (3 tests)

Run: `npm test`
Expected: PASS (aucune régression — le fake satisfait toujours l'interface)

- [ ] **Step 9: Commit**

```bash
npm run lint && npm run format
git add src/application tests/application src/infrastructure
git commit -m "feat(auth): add GetCurrentUser use case and findByUserId port"
```

---

### Task 2: Middleware d'authentification

**Files:**
- Create: `src/presentation/http/middlewares/authMiddleware.ts`
- Test: `tests/presentation/authMiddleware.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/presentation/authMiddleware.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import express, { Application } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

import { buildAuthMiddleware } from "@presentation/http/middlewares/authMiddleware";
import { FakeTokenProvider } from "../application/fakes";

/**
 * Tests du middleware d'authentification, monté sur une mini-app Express.
 *
 * Le `FakeTokenProvider` encode le payload en JSON préfixé `access:` ; un cookie
 * valide est donc `access_token=access:{"userId":...,"email":...}` (URI-encodé,
 * décodé par cookie-parser).
 */
describe("buildAuthMiddleware", () => {
  function buildApp(): Application {
    const app = express();
    app.use(cookieParser());
    app.use(buildAuthMiddleware(new FakeTokenProvider()));
    app.get("/", (req, res) => {
      res.status(200).json(req.user);
    });
    return app;
  }

  function validCookie(userId: string, email: string): string {
    const token = `access:${JSON.stringify({ userId, email })}`;
    return `access_token=${encodeURIComponent(token)}`;
  }

  it("renvoie 401 UNAUTHENTICATED sans cookie access_token", async () => {
    const res = await request(buildApp()).get("/");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("renvoie 401 UNAUTHENTICATED avec un token invalide", async () => {
    const res = await request(buildApp()).get("/").set("Cookie", "access_token=garbage");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("attache req.user et laisse passer avec un token valide", async () => {
    const res = await request(buildApp())
      .get("/")
      .set("Cookie", validCookie("user-1", "me@test.com"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: "user-1", email: "me@test.com" });
  });
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/presentation/authMiddleware.test.ts`
Expected: FAIL — `Cannot find module '@presentation/http/middlewares/authMiddleware'`

- [ ] **Step 3: Implémenter le middleware**

Créer `src/presentation/http/middlewares/authMiddleware.ts` :

```typescript
import { NextFunction, Request, RequestHandler, Response } from "express";
import { ITokenProvider } from "@application/auth/abstractions/services/ITokenProvider";
import { ACCESS_TOKEN_COOKIE } from "@presentation/http/mappers/AuthHttpMapper";

/**
 * Factory produisant le middleware d'authentification des routes protégées.
 *
 * Lit le jeton d'accès dans le cookie httpOnly `access_token`, le vérifie via le port
 * `ITokenProvider`, puis attache l'identité (`req.user`) pour les handlers suivants.
 * Cookie absent, jeton invalide ou expiré : la chaîne s'arrête sur un
 * `401 { code: "UNAUTHENTICATED" }` — côté client, l'intercepteur tentera un refresh
 * silencieux puis rejouera la requête.
 *
 * @param tokenProvider - Le vérificateur de jetons (injecté depuis `main.ts`).
 * @returns Le middleware Express à monter devant les routes protégées.
 */
export function buildAuthMiddleware(tokenProvider: ITokenProvider): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = (req.cookies as Record<string, string | undefined>)[ACCESS_TOKEN_COOKIE];
    const payload = token === undefined ? null : tokenProvider.verifyAccessToken(token);

    if (payload === null) {
      res.status(401).json({ code: "UNAUTHENTICATED", message: "Authentification requise." });
      return;
    }

    req.user = { userId: payload.userId, email: payload.email };
    next();
  };
}
```

Note : `req.user` est déjà déclaré dans `src/types/express.d.ts` — ne pas le redéclarer.

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/presentation/authMiddleware.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run format
git add src/presentation/http/middlewares/authMiddleware.ts tests/presentation/authMiddleware.test.ts
git commit -m "feat(auth): add JWT access token middleware for protected routes"
```

---

### Task 3: `UserController`, routes `/me` et câblage composition root

**Files:**
- Create: `src/presentation/http/controllers/UserController.ts`
- Create: `src/presentation/http/routes/userRoutes.ts`
- Modify: `src/main.ts` (signature `buildHttpApp` + câblage bootstrap)
- Modify: `tests/presentation/authRoutes.integration.test.ts` (nouvelle signature + tests `/me`)

- [ ] **Step 1: Écrire les tests d'intégration qui échouent**

Dans `tests/presentation/authRoutes.integration.test.ts` :

1. Ajouter les imports en tête de fichier :

```typescript
import { GetCurrentUserUseCase } from "@application/auth/usecases/GetCurrentUserUseCase";
import { UserController } from "@presentation/http/controllers/UserController";
import { buildAuthMiddleware } from "@presentation/http/middlewares/authMiddleware";
```

2. Dans `buildTestApp()`, remplacer la ligne `return buildHttpApp(controller, logger);` par :

```typescript
    const userController = new UserController(
      new GetCurrentUserUseCase(userRepository, credentialRepository),
    );
    const authMiddleware = buildAuthMiddleware(tokenProvider);

    return buildHttpApp(controller, userController, authMiddleware, logger);
```

3. Ajouter en fin de `describe` un bloc de tests `/me` :

```typescript
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
```

- [ ] **Step 2: Vérifier que la compilation/les tests échouent**

Run: `npx vitest run tests/presentation/authRoutes.integration.test.ts`
Expected: FAIL — `Cannot find module '@presentation/http/controllers/UserController'`

- [ ] **Step 3: Créer le controller**

`src/presentation/http/controllers/UserController.ts` :

```typescript
import { NextFunction, Request, Response } from "express";
import { IGetCurrentUserUseCase } from "@application/auth/abstractions/usecases/IGetCurrentUserUseCase";

/**
 * Controller HTTP des routes utilisateur protégées.
 *
 * Monté derrière le middleware d'authentification : `req.user` est donc toujours
 * renseigné ici. Comme `AuthController`, il ne dépend que des interfaces de use cases.
 */
export class UserController {
  /**
   * @param getCurrentUser - Use case de consultation du profil courant.
   */
  constructor(private readonly getCurrentUser: IGetCurrentUserUseCase) {}

  /**
   * `GET /me` — renvoie le profil de l'utilisateur authentifié.
   *
   * `UserNotFoundError` est traduite en **401** (et non 404) : un jeton valide pour
   * un compte disparu signifie que la session n'est plus valide — le client doit
   * se déconnecter.
   *
   * @param req - La requête (identité dans `req.user`, posée par le middleware).
   * @param res - La réponse.
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getCurrentUser.execute({ userId: req.user!.userId });

      if (result.isFailure) {
        res.status(401).json({ code: result.error.code, message: result.error.message });
        return;
      }

      const { userId, email, createdAt } = result.value;
      res.status(200).json({ userId, email, createdAt: createdAt.toISOString() });
    } catch (error) {
      next(error);
    }
  };
}
```

- [ ] **Step 4: Créer les routes**

`src/presentation/http/routes/userRoutes.ts` :

```typescript
import { Router } from "express";
import { UserController } from "@presentation/http/controllers/UserController";

/**
 * Construit le routeur Express des endpoints utilisateur protégés.
 *
 * Le middleware d'authentification est monté en amont (dans `buildHttpApp`), pas ici :
 * le routeur ne fait que câbler les chemins aux méthodes du controller.
 *
 * @param controller - Le controller utilisateur dont les méthodes traitent les requêtes.
 * @returns Le routeur Express configuré, à monter sous `/me`.
 */
export function buildUserRoutes(controller: UserController): Router {
  const router = Router();

  router.get("/", controller.me);

  return router;
}
```

- [ ] **Step 5: Mettre à jour `buildHttpApp` et le bootstrap dans `src/main.ts`**

1. Ajouter les imports :

```typescript
import { RequestHandler } from "express";
import { GetCurrentUserUseCase } from "@application/auth/usecases/GetCurrentUserUseCase";
import { UserController } from "@presentation/http/controllers/UserController";
import { buildUserRoutes } from "@presentation/http/routes/userRoutes";
import { buildAuthMiddleware } from "@presentation/http/middlewares/authMiddleware";
```

(`express` est déjà importé ; ajouter `RequestHandler` à la liste des imports nommés existants si besoin : `import express, { Application } from "express";` devient `import express, { Application, RequestHandler } from "express";`.)

2. Remplacer la signature et le corps de `buildHttpApp` :

```typescript
export function buildHttpApp(
  authController: AuthController,
  userController: UserController,
  authMiddleware: RequestHandler,
  logger: ILogger,
): Application {
  const app = express();

  // Le requestId doit être attaché en premier pour que tous les middlewares suivants
  // puissent corréler leurs logs avec l'identifiant de la requête.
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(buildHttpLoggerMiddleware(logger));

  app.use("/auth", buildAuthRoutes(authController));
  // Routes protégées : le middleware d'auth s'applique à tout ce qui est monté derrière.
  app.use("/me", authMiddleware, buildUserRoutes(userController));

  // Le middleware d'erreurs doit être enregistré en dernier.
  app.use(buildErrorHandler(logger));

  return app;
}
```

3. Dans `buildAuthController`, la construction des adapters reste inchangée. Mettre à jour `bootstrap()` pour construire les éléments partagés une seule fois — remplacer :

```typescript
  const authController = buildAuthController(connection, config, logger);
  const app = buildHttpApp(authController, logger);
```

par :

```typescript
  const authController = buildAuthController(connection, config, logger);

  const { tokenProvider } = buildSecurityAdapters(config);
  const { users, credentials } = createAuthRepositories(connection.getPool());
  const userController = new UserController(new GetCurrentUserUseCase(users, credentials));
  const authMiddleware = buildAuthMiddleware(tokenProvider);

  const app = buildHttpApp(authController, userController, authMiddleware, logger);
```

Note : `buildSecurityAdapters` et `createAuthRepositories` sont sans état (le `JwtTokenProvider` ne fait que lire la config, les repos partagent le même pool) — les rappeler ici est sans effet de bord et évite de changer la signature de `buildAuthController`.

- [ ] **Step 6: Vérifier que tous les tests passent**

Run: `npx vitest run tests/presentation/authRoutes.integration.test.ts`
Expected: PASS (tests existants + 4 nouveaux tests `/me`)

Run: `npm run test:coverage`
Expected: PASS, seuils ≥ 70 % respectés

Run: `npm run build`
Expected: compilation sans erreur

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run format
git add src/presentation src/main.ts tests/presentation
git commit -m "feat(auth): expose protected GET /me route"
```

---

### Task 4: Infrastructure Testcontainers + premiers tests `UserDao`

**Files:**
- Create: `db/migrationRunner.ts` (extraction depuis `db/umzug.ts`)
- Modify: `db/umzug.ts` (utilise `migrationRunner`)
- Create: `vitest.config.db.ts`
- Modify: `vitest.config.ts` (exclure `tests/db/**` de la config principale)
- Create: `tests/db/globalSetup.ts`
- Create: `tests/db/dbTestUtils.ts`
- Create: `tests/db/UserDao.test.ts`
- Modify: `package.json` (dépendances + script `test:db`)

- [ ] **Step 1: Installer les dépendances**

```bash
npm install --save-dev testcontainers @testcontainers/mysql
```

- [ ] **Step 2: Extraire le runner de migrations réutilisable**

Créer `db/migrationRunner.ts` en **déplaçant** depuis `db/umzug.ts` les constantes `MIGRATIONS_DIR`/`MIGRATIONS_TABLE` et les fonctions `ensureMigrationsTable`/`buildUmzug` (contenu identique, seul l'export change), puis en ajoutant `runMigrations` :

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql, { Pool } from "mysql2/promise";
import { Umzug } from "umzug";

/**
 * Cœur réutilisable du runner de migrations (pattern Flyway via Umzug).
 *
 * Extrait de `db/umzug.ts` pour être utilisable hors CLI : les tests d'intégration
 * Testcontainers exécutent les **mêmes migrations** contre un MySQL jetable, ce qui
 * valide à la fois les DAO et les migrations elles-mêmes.
 */

/** Répertoire contenant les fichiers de migration SQL. */
export const MIGRATIONS_DIR = resolve(__dirname, "migrations");

/** Nom de la table de suivi des migrations appliquées. */
export const MIGRATIONS_TABLE = "schema_migrations";

/**
 * Garantit l'existence de la table de suivi des migrations.
 *
 * @param pool - Le pool de connexions MySQL.
 */
export async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
       name       VARCHAR(255) NOT NULL,
       applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (name)
     ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci`,
  );
}

/**
 * Construit l'instance Umzug configurée pour exécuter les migrations SQL via mysql2.
 *
 * @param pool - Le pool de connexions MySQL partagé.
 * @returns L'instance Umzug paramétrée.
 */
export function buildUmzug(pool: Pool): Umzug<Pool> {
  return new Umzug<Pool>({
    context: pool,
    logger: console,
    migrations: {
      glob: ["*.sql", { cwd: MIGRATIONS_DIR }],
      resolve: ({ name, path }) => ({
        name,
        up: async () => {
          const sql = readFileSync(path as string, "utf8");
          await pool.query(sql);
          await pool.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`, [name]);
        },
        down: async () => {
          // Stratégie assumée : migrations **forward-only**. Aucun rollback automatique
          // n'est fourni, car retirer la seule trace sans annuler le DDL laisserait la base
          // dans un état incohérent (tables présentes mais marquées « non appliquées »).
          // Pour revenir en arrière, écrire une nouvelle migration `Vxxx` correctrice.
          throw new Error(
            `Rollback non supporté : les migrations sont forward-only. ` +
              `Pour annuler « ${name} », créez une nouvelle migration correctrice.`,
          );
        },
      }),
    },
    storage: {
      logMigration: async () => {
        /* trace gérée dans la migration `up` */
      },
      unlogMigration: async () => {
        /* trace gérée dans la migration `down` */
      },
      executed: async () => {
        const [rows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name ASC`,
        );
        return rows.map((row) => row["name"] as string);
      },
    },
  });
}

/**
 * Applique toutes les migrations en attente sur le pool fourni.
 *
 * Point d'entrée programmatique (sans lecture de `.env`) utilisé par les tests
 * d'intégration Testcontainers.
 *
 * @param pool - Le pool MySQL cible (doit autoriser `multipleStatements`).
 */
export async function runMigrations(pool: Pool): Promise<void> {
  await ensureMigrationsTable(pool);
  await buildUmzug(pool).up();
}
```

- [ ] **Step 3: Alléger `db/umzug.ts`**

Dans `db/umzug.ts` : supprimer les définitions de `MIGRATIONS_DIR`, `MIGRATIONS_TABLE`, `ensureMigrationsTable`, `buildUmzug` (et les imports devenus inutiles : `readFileSync`, `resolve`, `Umzug`), et importer à la place :

```typescript
import { buildUmzug, ensureMigrationsTable } from "./migrationRunner";
```

Le reste du fichier (`ensureSchema`, `createPool`, `main`) est inchangé. Vérifier que le CLI fonctionne toujours :

Run: `npm run migrate:status` (nécessite le MySQL local configuré dans `.env` ; si indisponible, vérifier simplement `npm run build` + `npm run lint`)
Expected: même sortie qu'avant le refactoring

- [ ] **Step 4: Exclure `tests/db` de la config Vitest principale**

Dans `vitest.config.ts`, sous `test:`, ajouter après `include` :

```typescript
    exclude: ["**/node_modules/**", "tests/db/**"],
```

- [ ] **Step 5: Créer la config Vitest dédiée**

`vitest.config.db.ts` :

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Configuration Vitest des tests d'intégration base de données (Testcontainers).
 *
 * Séparée de la config principale : ces tests exigent Docker et démarrent un conteneur
 * MySQL jetable (lent au premier run — téléchargement de l'image). Lancement :
 * `npm run test:db`. Pas de mesure de couverture ici : ces tests valident le SQL réel,
 * pas la complétude de la couverture.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@domain": resolve(__dirname, "src/domain"),
      "@application": resolve(__dirname, "src/application"),
      "@infrastructure": resolve(__dirname, "src/infrastructure"),
      "@presentation": resolve(__dirname, "src/presentation"),
      "@config": resolve(__dirname, "src/config"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/globalSetup.ts"],
    // Démarrage du conteneur : généreux au premier run (pull de l'image).
    hookTimeout: 180_000,
    testTimeout: 30_000,
    // Un seul worker : toutes les suites partagent le même conteneur/schéma.
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
  },
});
```

- [ ] **Step 6: Créer le setup global Testcontainers**

`tests/db/globalSetup.ts` :

```typescript
import { MySqlContainer, StartedMySqlContainer } from "@testcontainers/mysql";
import mysql from "mysql2/promise";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../db/migrationRunner";

/**
 * Setup global des tests d'intégration DB : démarre un conteneur MySQL jetable,
 * applique les migrations réelles (Umzug), puis expose les paramètres de connexion
 * aux suites de test via `provide`/`inject`.
 */

/** Paramètres de connexion exposés aux tests via `inject("db")`. */
export interface DbConnectionInfo {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    db: DbConnectionInfo;
  }
}

/** Mot de passe root du conteneur (jetable, valeur sans enjeu de sécurité). */
const ROOT_PASSWORD = "test";
/** Nom du schéma : identique à la prod car `V001` référence `e_jdr` en dur. */
const DATABASE = "e_jdr";

let container: StartedMySqlContainer;

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  container = await new MySqlContainer("mysql:8.4")
    .withDatabase(DATABASE)
    .withRootPassword(ROOT_PASSWORD)
    .start();

  const info: DbConnectionInfo = {
    host: container.getHost(),
    port: container.getPort(),
    // root : V001 exécute `CREATE SCHEMA IF NOT EXISTS`, qui exige ce privilège.
    user: "root",
    password: ROOT_PASSWORD,
    database: DATABASE,
  };

  const pool = mysql.createPool({ ...info, multipleStatements: true });
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }

  project.provide("db", info);

  return async () => {
    await container.stop();
  };
}
```

- [ ] **Step 7: Créer les utilitaires de test DB**

`tests/db/dbTestUtils.ts` :

```typescript
import mysql, { Pool } from "mysql2/promise";
import { inject } from "vitest";

/**
 * Utilitaires partagés des suites de tests DB : connexion au conteneur démarré
 * par `globalSetup.ts` et remise à zéro des tables entre les tests.
 */

/**
 * Crée un pool connecté au MySQL de test (paramètres injectés par le setup global).
 *
 * @returns Un pool `mysql2/promise` à fermer en `afterAll`.
 */
export function createTestPool(): Pool {
  const db = inject("db");
  return mysql.createPool({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
  });
}

/**
 * Vide toutes les tables métier, enfants d'abord (contraintes FK).
 *
 * @param pool - Le pool de test.
 */
export async function truncateAllTables(pool: Pool): Promise<void> {
  await pool.execute("DELETE FROM refresh_tokens");
  await pool.execute("DELETE FROM credentials");
  await pool.execute("DELETE FROM users");
}

/**
 * Insère un utilisateur minimal (satisfait les FK de `credentials`/`refresh_tokens`).
 *
 * @param pool - Le pool de test.
 * @param id - L'identifiant de l'utilisateur.
 */
export async function insertUser(pool: Pool, id: string): Promise<void> {
  await pool.execute("INSERT INTO users (id, created_at) VALUES (?, ?)", [
    id,
    new Date("2026-01-01T10:00:00Z"),
  ]);
}
```

- [ ] **Step 8: Écrire la suite `UserDao`**

`tests/db/UserDao.test.ts` :

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "mysql2/promise";

import { UserDao } from "@infrastructure/persistence/mysql/auth/dao/UserDao";
import { createTestPool, truncateAllTables } from "./dbTestUtils";

/**
 * Tests d'intégration du `UserDao` contre un MySQL réel (Testcontainers).
 *
 * Valide le SQL et le schéma migré — ce que les tests unitaires (fakes) ne voient pas.
 * Les dates utilisent des secondes entières : `DATETIME` ne stocke pas les millisecondes.
 */
describe("UserDao (intégration MySQL)", () => {
  let pool: Pool;
  let dao: UserDao;

  beforeAll(() => {
    pool = createTestPool();
    dao = new UserDao(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await truncateAllTables(pool);
  });

  it("insert puis findById renvoie la ligne insérée", async () => {
    const createdAt = new Date("2026-01-02T08:30:00Z");
    await dao.insert({ id: "user-1", created_at: createdAt });

    const row = await dao.findById("user-1");

    expect(row).not.toBeNull();
    expect(row!.id).toBe("user-1");
    expect(row!.created_at.getTime()).toBe(createdAt.getTime());
  });

  it("findById renvoie null pour un id inconnu", async () => {
    const row = await dao.findById("ghost");

    expect(row).toBeNull();
  });

  it("insert refuse un id en double (PRIMARY KEY)", async () => {
    await dao.insert({ id: "user-1", created_at: new Date("2026-01-02T08:30:00Z") });

    await expect(
      dao.insert({ id: "user-1", created_at: new Date("2026-01-02T09:00:00Z") }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 9: Ajouter le script npm et lancer**

Dans `package.json`, section `scripts`, après `"test:coverage"` :

```json
    "test:db": "vitest run --config vitest.config.db.ts",
```

Run: `npm run test:db` (Docker Desktop doit tourner ; premier run lent — pull de `mysql:8.4`)
Expected: PASS (3 tests UserDao)

Run: `npm test`
Expected: PASS, et les tests `tests/db/**` n'apparaissent PAS dans la sortie (exclusion vérifiée)

- [ ] **Step 10: Commit**

```bash
npm run lint && npm run format
git add db/ vitest.config.ts vitest.config.db.ts tests/db package.json package-lock.json
git commit -m "test(db): add Testcontainers MySQL integration setup and UserDao suite"
```

---

### Task 5: Suite `CredentialDao`

**Files:**
- Test: `tests/db/CredentialDao.test.ts`

- [ ] **Step 1: Écrire la suite**

`tests/db/CredentialDao.test.ts` :

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "mysql2/promise";

import { CredentialDao } from "@infrastructure/persistence/mysql/auth/dao/CredentialDao";
import { createTestPool, truncateAllTables, insertUser } from "./dbTestUtils";

/**
 * Tests d'intégration du `CredentialDao` contre un MySQL réel (Testcontainers).
 *
 * Couvre le CRUD, les contraintes (UNIQUE e-mail, FK user_id) et les champs
 * anti-brute-force (`failed_attempts`, `locked_until`) ajoutés par V003.
 */
describe("CredentialDao (intégration MySQL)", () => {
  let pool: Pool;
  let dao: CredentialDao;

  const baseRow = {
    id: "cred-1",
    user_id: "user-1",
    email: "me@test.com",
    password_hash: "bcrypt-hash",
    created_at: new Date("2026-01-02T08:30:00Z"),
    failed_attempts: 0,
    locked_until: null as Date | null,
  };

  beforeAll(() => {
    pool = createTestPool();
    dao = new CredentialDao(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await truncateAllTables(pool);
    await insertUser(pool, "user-1");
  });

  it("insert puis findByEmail renvoie la ligne complète", async () => {
    await dao.insert(baseRow);

    const row = await dao.findByEmail("me@test.com");

    expect(row).not.toBeNull();
    expect(row!.id).toBe("cred-1");
    expect(row!.user_id).toBe("user-1");
    expect(row!.password_hash).toBe("bcrypt-hash");
    expect(row!.failed_attempts).toBe(0);
    expect(row!.locked_until).toBeNull();
  });

  it("findByUserId renvoie la ligne du bon utilisateur", async () => {
    await dao.insert(baseRow);

    const row = await dao.findByUserId("user-1");

    expect(row).not.toBeNull();
    expect(row!.email).toBe("me@test.com");
  });

  it("findByUserId renvoie null pour un utilisateur sans credential", async () => {
    expect(await dao.findByUserId("user-1")).toBeNull();
  });

  it("existsByEmail distingue présent/absent", async () => {
    await dao.insert(baseRow);

    expect(await dao.existsByEmail("me@test.com")).toBe(true);
    expect(await dao.existsByEmail("other@test.com")).toBe(false);
  });

  it("update persiste les champs de verrouillage", async () => {
    await dao.insert(baseRow);
    const lockedUntil = new Date("2026-01-02T09:00:00Z");

    await dao.update("cred-1", { failed_attempts: 5, locked_until: lockedUntil });

    const row = await dao.findByEmail("me@test.com");
    expect(row!.failed_attempts).toBe(5);
    expect(row!.locked_until!.getTime()).toBe(lockedUntil.getTime());
  });

  it("insert refuse un e-mail en double (UNIQUE)", async () => {
    await dao.insert(baseRow);
    await insertUser(pool, "user-2");

    await expect(
      dao.insert({ ...baseRow, id: "cred-2", user_id: "user-2" }),
    ).rejects.toThrow();
  });

  it("insert refuse un user_id inexistant (FK)", async () => {
    await expect(dao.insert({ ...baseRow, user_id: "ghost" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Lancer la suite**

Run: `npm run test:db`
Expected: PASS (suites UserDao + CredentialDao)

- [ ] **Step 3: Commit**

```bash
npm run lint && npm run format
git add tests/db/CredentialDao.test.ts
git commit -m "test(db): add CredentialDao integration suite"
```

---

### Task 6: Suite `RefreshTokenDao`

**Files:**
- Test: `tests/db/RefreshTokenDao.test.ts`

- [ ] **Step 1: Écrire la suite**

`tests/db/RefreshTokenDao.test.ts` :

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "mysql2/promise";

import { RefreshTokenDao } from "@infrastructure/persistence/mysql/auth/dao/RefreshTokenDao";
import { createTestPool, truncateAllTables, insertUser } from "./dbTestUtils";

/**
 * Tests d'intégration du `RefreshTokenDao` contre un MySQL réel (Testcontainers).
 *
 * Couvre le cycle de vie des sessions révocables : insertion, recherche par empreinte,
 * révocations ciblées et purge des jetons expirés (index `expires_at` de V002).
 */
describe("RefreshTokenDao (intégration MySQL)", () => {
  let pool: Pool;
  let dao: RefreshTokenDao;

  function buildRow(id: string, userId: string, tokenHash: string, expiresAt: Date) {
    return {
      id,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: new Date("2026-01-02T08:30:00Z"),
    };
  }

  beforeAll(() => {
    pool = createTestPool();
    dao = new RefreshTokenDao(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await truncateAllTables(pool);
    await insertUser(pool, "user-1");
    await insertUser(pool, "user-2");
  });

  it("insert puis findByTokenHash renvoie la ligne", async () => {
    const expiresAt = new Date("2026-02-01T00:00:00Z");
    await dao.insert(buildRow("rt-1", "user-1", "hash-1", expiresAt));

    const row = await dao.findByTokenHash("hash-1");

    expect(row).not.toBeNull();
    expect(row!.user_id).toBe("user-1");
    expect(row!.expires_at.getTime()).toBe(expiresAt.getTime());
  });

  it("findByTokenHash renvoie null pour une empreinte inconnue", async () => {
    expect(await dao.findByTokenHash("ghost")).toBeNull();
  });

  it("deleteByTokenHash supprime uniquement la ligne visée", async () => {
    await dao.insert(buildRow("rt-1", "user-1", "hash-1", new Date("2026-02-01T00:00:00Z")));
    await dao.insert(buildRow("rt-2", "user-1", "hash-2", new Date("2026-02-01T00:00:00Z")));

    await dao.deleteByTokenHash("hash-1");

    expect(await dao.findByTokenHash("hash-1")).toBeNull();
    expect(await dao.findByTokenHash("hash-2")).not.toBeNull();
  });

  it("deleteAllForUser supprime toutes les sessions d'un utilisateur sans toucher les autres", async () => {
    await dao.insert(buildRow("rt-1", "user-1", "hash-1", new Date("2026-02-01T00:00:00Z")));
    await dao.insert(buildRow("rt-2", "user-1", "hash-2", new Date("2026-02-01T00:00:00Z")));
    await dao.insert(buildRow("rt-3", "user-2", "hash-3", new Date("2026-02-01T00:00:00Z")));

    await dao.deleteAllForUser("user-1");

    expect(await dao.findByTokenHash("hash-1")).toBeNull();
    expect(await dao.findByTokenHash("hash-2")).toBeNull();
    expect(await dao.findByTokenHash("hash-3")).not.toBeNull();
  });

  it("deleteExpired purge les jetons expirés et conserve les valides", async () => {
    const now = new Date("2026-01-15T00:00:00Z");
    await dao.insert(buildRow("rt-1", "user-1", "hash-expired", new Date("2026-01-10T00:00:00Z")));
    await dao.insert(buildRow("rt-2", "user-1", "hash-valid", new Date("2026-02-01T00:00:00Z")));

    await dao.deleteExpired(now);

    expect(await dao.findByTokenHash("hash-expired")).toBeNull();
    expect(await dao.findByTokenHash("hash-valid")).not.toBeNull();
  });

  it("insert refuse une empreinte en double (UNIQUE token_hash)", async () => {
    await dao.insert(buildRow("rt-1", "user-1", "hash-1", new Date("2026-02-01T00:00:00Z")));

    await expect(
      dao.insert(buildRow("rt-2", "user-2", "hash-1", new Date("2026-02-01T00:00:00Z"))),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Lancer la suite**

Run: `npm run test:db`
Expected: PASS (3 suites, ~16 tests)

- [ ] **Step 3: Commit**

```bash
npm run lint && npm run format
git add tests/db/RefreshTokenDao.test.ts
git commit -m "test(db): add RefreshTokenDao integration suite"
```

---

### Task 7: Job CI `db-tests`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Ajouter le job**

Dans `.github/workflows/ci.yml`, ajouter après le job `build-and-test` (même indentation que lui, sous `jobs:`) :

```yaml
  db-tests:
    name: DB integration tests (Testcontainers)
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run DB integration tests
        run: npm run test:db
```

Note : Docker est préinstallé sur `ubuntu-latest`, aucun service à déclarer — Testcontainers gère le cycle de vie du conteneur.

- [ ] **Step 2: Vérifier la syntaxe YAML localement**

Run: `npx prettier --check .github/workflows/ci.yml`
Expected: pas d'erreur de format

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run Testcontainers DB integration tests in dedicated job"
```

---

### Task 8: Vérification finale

- [ ] **Step 1: Suite complète**

```bash
npm run lint
npm run format:check
npm run test:coverage
npm run test:db
npm run build
```

Expected: tout PASS, couverture ≥ 70 %.

- [ ] **Step 2: Vérification manuelle de bout en bout (optionnelle si MySQL local dispo)**

```bash
npm run serve
# Dans un autre terminal :
curl -i -c cookies.txt -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d "{\"email\":\"e2e@test.com\",\"password\":\"password1!\"}"
curl -i -b cookies.txt http://localhost:3000/me
# Attendu : 200 {"userId":"...","email":"e2e@test.com","createdAt":"..."}
curl -i http://localhost:3000/me
# Attendu : 401 {"code":"UNAUTHENTICATED",...}
```
