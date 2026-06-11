# Refactoring présentation HTTP + composition root Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réorganiser `src/presentation/http/` en feature/shared, supprimer la double instanciation dans `main.ts`.

**Architecture:** Deux tâches distinctes — (A) déplacer les fichiers de présentation vers `features/auth/` et `shared/middlewares/`, puis mettre à jour tous les imports ; (B) extraire `buildServices()` dans `main.ts` pour ne construire repos, security adapters et authTokenService qu'une seule fois. Les deux tâches doivent finir par `npx tsc --noEmit && npm test && npm run lint` vert avant commit.

**Tech Stack:** TypeScript, Express, Vitest, ESLint custom rules (file-size 500, function-size 100, parameter-count 6, naming-convention, clean-architecture), alias `@presentation/*`.

---

## Périmètre des fichiers

### Tâche A — Restructuration de src/presentation/http/

| Action | Source | Destination |
|--------|--------|-------------|
| git mv | `src/presentation/http/middlewares/authMiddleware.ts` | `src/presentation/http/shared/middlewares/authMiddleware.ts` |
| git mv | `src/presentation/http/middlewares/errorHandler.ts` | `src/presentation/http/shared/middlewares/errorHandler.ts` |
| git mv | `src/presentation/http/middlewares/httpLoggerMiddleware.ts` | `src/presentation/http/shared/middlewares/httpLoggerMiddleware.ts` |
| git mv | `src/presentation/http/middlewares/requestIdMiddleware.ts` | `src/presentation/http/shared/middlewares/requestIdMiddleware.ts` |
| git mv | `src/presentation/http/controllers/AuthController.ts` | `src/presentation/http/features/auth/controllers/AuthController.ts` |
| git mv | `src/presentation/http/controllers/UserController.ts` | `src/presentation/http/features/auth/controllers/UserController.ts` |
| git mv | `src/presentation/http/routes/authRoutes.ts` | `src/presentation/http/features/auth/routes/authRoutes.ts` |
| git mv | `src/presentation/http/routes/userRoutes.ts` | `src/presentation/http/features/auth/routes/userRoutes.ts` |
| git mv | `src/presentation/http/mappers/AuthHttpMapper.ts` | `src/presentation/http/features/auth/mappers/AuthHttpMapper.ts` |

**Fichiers dont les imports doivent être mis à jour (après les git mv) :**
- `src/presentation/http/features/auth/controllers/AuthController.ts` — importe `AuthHttpMapper`
- `src/presentation/http/features/auth/routes/authRoutes.ts` — importe `AuthController`
- `src/presentation/http/features/auth/routes/userRoutes.ts` — importe `UserController`
- `src/presentation/http/shared/middlewares/authMiddleware.ts` — importe `ACCESS_TOKEN_COOKIE` depuis `AuthHttpMapper`
- `src/main.ts` — importe tout ce qui a bougé
- `tests/presentation/authRoutes.integration.test.ts` — importe `AuthController`, `buildAuthRoutes`, `buildErrorHandler`, `UserController`, `buildAuthMiddleware`
- `tests/presentation/authMiddleware.test.ts` — importe `buildAuthMiddleware`

### Tâche B — Refactoring main.ts

**Fichier modifié :** `src/main.ts` uniquement.

Objectif : extraire `buildServices(connection, config, logger)` qui retourne un objet contenant repos, unitOfWork, security adapters et `authTokenService`. `buildAuthController` et la construction de `UserController`/`buildAuthMiddleware` consomment cet objet. Zéro double instanciation.

---

## Task 1: Créer les dossiers cibles

**Files:**
- Create directories: `src/presentation/http/shared/middlewares/` et `src/presentation/http/features/auth/controllers/`, `…/routes/`, `…/mappers/`

- [ ] **Step 1: Créer les dossiers**

```powershell
New-Item -ItemType Directory -Force "src\presentation\http\shared\middlewares"
New-Item -ItemType Directory -Force "src\presentation\http\features\auth\controllers"
New-Item -ItemType Directory -Force "src\presentation\http\features\auth\routes"
New-Item -ItemType Directory -Force "src\presentation\http\features\auth\mappers"
```

Run depuis `C:\Users\yomdr\Documents\ProjetDev\Equipe\E-JDR\E-JDR-Backend`.
Expected: les 4 dossiers créés, pas d'erreur.

---

## Task 2: git mv des middlewares transversaux vers shared/middlewares/

**Files:**
- Modify (move): `src/presentation/http/middlewares/authMiddleware.ts` → `src/presentation/http/shared/middlewares/authMiddleware.ts`
- Modify (move): `src/presentation/http/middlewares/errorHandler.ts` → `src/presentation/http/shared/middlewares/errorHandler.ts`
- Modify (move): `src/presentation/http/middlewares/httpLoggerMiddleware.ts` → `src/presentation/http/shared/middlewares/httpLoggerMiddleware.ts`
- Modify (move): `src/presentation/http/middlewares/requestIdMiddleware.ts` → `src/presentation/http/shared/middlewares/requestIdMiddleware.ts`

- [ ] **Step 1: Déplacer les 4 middlewares avec git mv**

```powershell
git mv "src/presentation/http/middlewares/authMiddleware.ts" "src/presentation/http/shared/middlewares/authMiddleware.ts"
git mv "src/presentation/http/middlewares/errorHandler.ts" "src/presentation/http/shared/middlewares/errorHandler.ts"
git mv "src/presentation/http/middlewares/httpLoggerMiddleware.ts" "src/presentation/http/shared/middlewares/httpLoggerMiddleware.ts"
git mv "src/presentation/http/middlewares/requestIdMiddleware.ts" "src/presentation/http/shared/middlewares/requestIdMiddleware.ts"
```

Expected: `git status` montre 4 `renamed:` sous `Changes to be committed`.

---

## Task 3: git mv des fichiers feature/auth vers features/auth/

**Files:**
- Modify (move): `src/presentation/http/controllers/AuthController.ts` → `src/presentation/http/features/auth/controllers/AuthController.ts`
- Modify (move): `src/presentation/http/controllers/UserController.ts` → `src/presentation/http/features/auth/controllers/UserController.ts`
- Modify (move): `src/presentation/http/routes/authRoutes.ts` → `src/presentation/http/features/auth/routes/authRoutes.ts`
- Modify (move): `src/presentation/http/routes/userRoutes.ts` → `src/presentation/http/features/auth/routes/userRoutes.ts`
- Modify (move): `src/presentation/http/mappers/AuthHttpMapper.ts` → `src/presentation/http/features/auth/mappers/AuthHttpMapper.ts`

- [ ] **Step 1: Déplacer les 5 fichiers feature/auth avec git mv**

```powershell
git mv "src/presentation/http/controllers/AuthController.ts" "src/presentation/http/features/auth/controllers/AuthController.ts"
git mv "src/presentation/http/controllers/UserController.ts" "src/presentation/http/features/auth/controllers/UserController.ts"
git mv "src/presentation/http/routes/authRoutes.ts" "src/presentation/http/features/auth/routes/authRoutes.ts"
git mv "src/presentation/http/routes/userRoutes.ts" "src/presentation/http/features/auth/routes/userRoutes.ts"
git mv "src/presentation/http/mappers/AuthHttpMapper.ts" "src/presentation/http/features/auth/mappers/AuthHttpMapper.ts"
```

Expected: `git status` montre 9 `renamed:` au total.

---

## Task 4: Mettre à jour les imports dans les fichiers déplacés

**Files:**
- Modify: `src/presentation/http/features/auth/controllers/AuthController.ts`
- Modify: `src/presentation/http/features/auth/routes/authRoutes.ts`
- Modify: `src/presentation/http/features/auth/routes/userRoutes.ts`
- Modify: `src/presentation/http/shared/middlewares/authMiddleware.ts`

- [ ] **Step 1: Corriger AuthController.ts**

Dans `src/presentation/http/features/auth/controllers/AuthController.ts`, remplacer :
```typescript
import { AuthHttpMapper } from "@presentation/http/mappers/AuthHttpMapper";
```
par :
```typescript
import { AuthHttpMapper } from "@presentation/http/features/auth/mappers/AuthHttpMapper";
```

- [ ] **Step 2: Corriger authRoutes.ts**

Dans `src/presentation/http/features/auth/routes/authRoutes.ts`, remplacer :
```typescript
import { AuthController } from "@presentation/http/controllers/AuthController";
```
par :
```typescript
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
```

- [ ] **Step 3: Corriger userRoutes.ts**

Dans `src/presentation/http/features/auth/routes/userRoutes.ts`, remplacer :
```typescript
import { UserController } from "@presentation/http/controllers/UserController";
```
par :
```typescript
import { UserController } from "@presentation/http/features/auth/controllers/UserController";
```

- [ ] **Step 4: Corriger authMiddleware.ts**

Dans `src/presentation/http/shared/middlewares/authMiddleware.ts`, remplacer :
```typescript
import { ACCESS_TOKEN_COOKIE } from "@presentation/http/mappers/AuthHttpMapper";
```
par :
```typescript
import { ACCESS_TOKEN_COOKIE } from "@presentation/http/features/auth/mappers/AuthHttpMapper";
```

---

## Task 5: Mettre à jour les imports dans main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Mettre à jour le bloc d'imports Presentation dans main.ts**

Dans `src/main.ts`, remplacer le bloc d'imports `// Presentation` :
```typescript
// Presentation
import { AuthController } from "@presentation/http/controllers/AuthController";
import { UserController } from "@presentation/http/controllers/UserController";
import { buildAuthRoutes } from "@presentation/http/routes/authRoutes";
import { buildUserRoutes } from "@presentation/http/routes/userRoutes";
import { requestIdMiddleware } from "@presentation/http/middlewares/requestIdMiddleware";
import { buildHttpLoggerMiddleware } from "@presentation/http/middlewares/httpLoggerMiddleware";
import { buildErrorHandler } from "@presentation/http/middlewares/errorHandler";
import { buildAuthMiddleware } from "@presentation/http/middlewares/authMiddleware";
```
par :
```typescript
// Presentation — feature auth
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
import { UserController } from "@presentation/http/features/auth/controllers/UserController";
import { buildAuthRoutes } from "@presentation/http/features/auth/routes/authRoutes";
import { buildUserRoutes } from "@presentation/http/features/auth/routes/userRoutes";
// Presentation — shared middlewares
import { requestIdMiddleware } from "@presentation/http/shared/middlewares/requestIdMiddleware";
import { buildHttpLoggerMiddleware } from "@presentation/http/shared/middlewares/httpLoggerMiddleware";
import { buildErrorHandler } from "@presentation/http/shared/middlewares/errorHandler";
import { buildAuthMiddleware } from "@presentation/http/shared/middlewares/authMiddleware";
```

---

## Task 6: Mettre à jour les imports dans les tests

**Files:**
- Modify: `tests/presentation/authRoutes.integration.test.ts`
- Modify: `tests/presentation/authMiddleware.test.ts`

- [ ] **Step 1: Corriger authRoutes.integration.test.ts**

Dans `tests/presentation/authRoutes.integration.test.ts`, remplacer :
```typescript
import { AuthController } from "@presentation/http/controllers/AuthController";
import { buildAuthRoutes } from "@presentation/http/routes/authRoutes";
import { buildErrorHandler } from "@presentation/http/middlewares/errorHandler";
```
par :
```typescript
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
import { buildAuthRoutes } from "@presentation/http/features/auth/routes/authRoutes";
import { buildErrorHandler } from "@presentation/http/shared/middlewares/errorHandler";
```

Et remplacer :
```typescript
import { UserController } from "@presentation/http/controllers/UserController";
import { buildAuthMiddleware } from "@presentation/http/middlewares/authMiddleware";
```
par :
```typescript
import { UserController } from "@presentation/http/features/auth/controllers/UserController";
import { buildAuthMiddleware } from "@presentation/http/shared/middlewares/authMiddleware";
```

- [ ] **Step 2: Corriger authMiddleware.test.ts**

Dans `tests/presentation/authMiddleware.test.ts`, remplacer :
```typescript
import { buildAuthMiddleware } from "@presentation/http/middlewares/authMiddleware";
```
par :
```typescript
import { buildAuthMiddleware } from "@presentation/http/shared/middlewares/authMiddleware";
```

---

## Task 7: Vérifier — aucune ancienne référence de chemin ne subsiste

**Files:**
- Check (read-only): tous les fichiers `src/**/*.ts` et `tests/**/*.ts`

- [ ] **Step 1: Grep pour les anciens chemins**

```powershell
# Chacune de ces commandes doit retourner 0 résultat
Select-String -Path "src/**/*.ts","tests/**/*.ts" -Pattern "@presentation/http/controllers" -Recurse
Select-String -Path "src/**/*.ts","tests/**/*.ts" -Pattern "@presentation/http/routes" -Recurse
Select-String -Path "src/**/*.ts","tests/**/*.ts" -Pattern "@presentation/http/mappers" -Recurse
Select-String -Path "src/**/*.ts","tests/**/*.ts" -Pattern "@presentation/http/middlewares" -Recurse
```

Expected: aucune ligne de résultat pour aucune des 4 commandes.

Si des résultats apparaissent, corriger les imports manqués avant de continuer.

---

## Task 8: tsc + tests (filet de sécurité tâche A)

- [ ] **Step 1: Vérifier la compilation TypeScript**

```powershell
npx tsc --noEmit
```

Expected: aucune erreur, code de sortie 0.

- [ ] **Step 2: Lancer les tests**

```powershell
npm test
```

Expected: `73 tests passed`, code de sortie 0. Si un test échoue, inspecter le message d'erreur — presque certainement un import manqué.

- [ ] **Step 3: Lancer le linter**

```powershell
npm run lint
```

Expected: `0 warnings`, code de sortie 0.

---

## Task 9: Commit A

- [ ] **Step 1: Stager et commiter**

```powershell
git add -A
git commit -m "refactor(presentation): organize HTTP layer by feature with shared middlewares"
```

Expected: commit créé avec SHA. `git status` montre un working tree propre.

---

## Task 10: Refactorer main.ts — extraire buildServices()

**Files:**
- Modify: `src/main.ts`

Le problème : dans `bootstrap()`, `buildSecurityAdapters(config)` et `createAuthRepositories(connection.getPool())` sont appelés une 2e fois (lignes 171-172 de la version originale) pour câbler `UserController` et `buildAuthMiddleware`, après que `buildAuthController` les a déjà appelés en interne.

La solution : extraire `buildServices(connection, config, logger)` qui construit **une seule fois** repos, unitOfWork, security adapters et `authTokenService`. `buildAuthController` devient `buildAuthController(services, config, logger)` (reçoit les services pré-construits). `UserController` et `buildAuthMiddleware` consomment les mêmes instances depuis `services`.

- [ ] **Step 1: Réécrire src/main.ts**

Remplacer **tout le contenu** de `src/main.ts` par :

```typescript
import express, { Application, RequestHandler } from "express";
import cookieParser from "cookie-parser";

import { AppConfig, loadConfig } from "@config/env";

// Infrastructure
import { MysqlConnection } from "@infrastructure/persistence/mysql/MysqlConnection";
import { createAuthRepositories } from "@infrastructure/persistence/mysql/features/auth/createAuthRepositories";
import { MysqlUnitOfWork } from "@infrastructure/persistence/mysql/MysqlUnitOfWork";
import { PasswordHasherServiceImpl } from "@infrastructure/security/PasswordHasherServiceImpl";
import { TokenProviderServiceImpl } from "@infrastructure/security/TokenProviderServiceImpl";
import { TokenHasherServiceImpl } from "@infrastructure/security/TokenHasherServiceImpl";
import { IdGeneratorServiceImpl } from "@infrastructure/id/IdGeneratorServiceImpl";
import { PinoLogger } from "@infrastructure/logging/PinoLogger";

// Application
import { Logger } from "@application/shared/Logger";
import { AuthTokenServiceImpl } from "@application/features/auth/services/AuthTokenServiceImpl";
import { RegisterUserUseCaseImpl } from "@application/features/auth/usecases/RegisterUserUseCaseImpl";
import { LoginUserUseCaseImpl } from "@application/features/auth/usecases/LoginUserUseCaseImpl";
import { LogoutUserUseCaseImpl } from "@application/features/auth/usecases/LogoutUserUseCaseImpl";
import { RefreshAccessTokenUseCaseImpl } from "@application/features/auth/usecases/RefreshAccessTokenUseCaseImpl";
import { GetCurrentUserUseCaseImpl } from "@application/features/auth/usecases/GetCurrentUserUseCaseImpl";

// Presentation — feature auth
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
import { UserController } from "@presentation/http/features/auth/controllers/UserController";
import { buildAuthRoutes } from "@presentation/http/features/auth/routes/authRoutes";
import { buildUserRoutes } from "@presentation/http/features/auth/routes/userRoutes";
// Presentation — shared middlewares
import { requestIdMiddleware } from "@presentation/http/shared/middlewares/requestIdMiddleware";
import { buildHttpLoggerMiddleware } from "@presentation/http/shared/middlewares/httpLoggerMiddleware";
import { buildErrorHandler } from "@presentation/http/shared/middlewares/errorHandler";
import { buildAuthMiddleware } from "@presentation/http/shared/middlewares/authMiddleware";

/**
 * **Composition root** de l'application : seul endroit qui instancie les classes concrètes
 * et résout les dépendances (injection manuelle). C'est ce câblage qui rend chaque couche
 * interchangeable (DIP) : pour changer d'implémentation (ex : autre BDD), on ne touche qu'ici.
 *
 * Le flux d'assemblage suit les dépendances : infrastructure → services/use cases (application)
 * → controller/routes (présentation) → application Express.
 */

/** Regroupe les services partagés construits une seule fois dans le composition root. */
interface AuthServices {
  userRepository: ReturnType<typeof createAuthRepositories>["users"];
  credentialRepository: ReturnType<typeof createAuthRepositories>["credentials"];
  refreshTokenRepository: ReturnType<typeof createAuthRepositories>["refreshTokens"];
  unitOfWork: MysqlUnitOfWork;
  passwordHasher: PasswordHasherServiceImpl;
  tokenProvider: TokenProviderServiceImpl;
  tokenHasher: TokenHasherServiceImpl;
  idGenerator: IdGeneratorServiceImpl;
  authTokenService: AuthTokenServiceImpl;
}

/**
 * Construit UNE SEULE FOIS les repositories, adapters de sécurité et services partagés.
 *
 * Centraliser ici évite de recréer des instances identiques (sans état) pour câbler
 * le middleware d'auth et UserController séparément du composition root principal.
 *
 * @param connection - La connexion MySQL active.
 * @param config - La configuration applicative (secrets JWT, environnement).
 * @returns L'ensemble des services prêts à être consommés par les controllers et middlewares.
 */
function buildServices(connection: MysqlConnection, config: AppConfig): AuthServices {
  const {
    users: userRepository,
    credentials: credentialRepository,
    refreshTokens: refreshTokenRepository,
  } = createAuthRepositories(connection.getPool());

  const unitOfWork = new MysqlUnitOfWork(connection);

  const passwordHasher = new PasswordHasherServiceImpl();
  const tokenProvider = new TokenProviderServiceImpl({
    accessSecret: config.jwt.accessSecret,
    refreshSecret: config.jwt.refreshSecret,
    accessExpiresIn: config.jwt.accessExpiresIn,
    refreshExpiresIn: config.jwt.refreshExpiresIn,
  });
  const tokenHasher = new TokenHasherServiceImpl();
  const idGenerator = new IdGeneratorServiceImpl();

  const authTokenService = new AuthTokenServiceImpl(
    tokenProvider,
    tokenHasher,
    idGenerator,
    refreshTokenRepository,
  );

  return {
    userRepository,
    credentialRepository,
    refreshTokenRepository,
    unitOfWork,
    passwordHasher,
    tokenProvider,
    tokenHasher,
    idGenerator,
    authTokenService,
  };
}

/**
 * Assemble le controller d'authentification à partir des services déjà construits.
 *
 * @param services - Les services partagés produits par {@link buildServices}.
 * @param config - La configuration applicative (flag `isProduction` pour les cookies).
 * @param logger - Le logger applicatif.
 * @returns Le controller d'authentification câblé.
 */
function buildAuthController(services: AuthServices, config: AppConfig, logger: Logger): AuthController {
  const registerUser = new RegisterUserUseCaseImpl(
    services.credentialRepository,
    services.passwordHasher,
    services.idGenerator,
    services.authTokenService,
    services.unitOfWork,
    logger,
  );
  const loginUser = new LoginUserUseCaseImpl(
    services.credentialRepository,
    services.passwordHasher,
    services.authTokenService,
    services.unitOfWork,
    logger,
  );
  const logoutUser = new LogoutUserUseCaseImpl(services.tokenHasher, services.unitOfWork);
  const refreshAccessToken = new RefreshAccessTokenUseCaseImpl(
    services.userRepository,
    services.refreshTokenRepository,
    services.tokenProvider,
    services.tokenHasher,
    services.authTokenService,
    services.unitOfWork,
  );

  return new AuthController(registerUser, loginUser, logoutUser, refreshAccessToken, config);
}

/**
 * Construit l'application Express : middlewares globaux, routes, gestion d'erreurs.
 *
 * Exportée pour permettre des tests d'intégration HTTP (via supertest) qui montent la
 * pile Express réelle — routage, parsing JSON, cookies, controllers, gestion d'erreurs —
 * en injectant les controllers câblés sur des doublures, sans base de données.
 *
 * @param authController - Le controller d'authentification câblé.
 * @param userController - Le controller des routes utilisateur protégées.
 * @param authMiddleware - Le middleware de vérification du jeton d'accès.
 * @param logger - Le logger applicatif (injecté pour structurer les logs et les erreurs).
 * @returns L'application Express prête à écouter.
 */
export function buildHttpApp(
  authController: AuthController,
  userController: UserController,
  authMiddleware: RequestHandler,
  logger: Logger,
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

/**
 * Démarre le serveur : charge la config, ouvre la connexion BDD, assemble et écoute.
 *
 * @returns Une promesse résolue lorsque le serveur écoute.
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = PinoLogger.create(config.logLevel);

  const connection = new MysqlConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
  });

  // Construction unique de tous les services partagés (repos, adapters de sécurité, authTokenService).
  const services = buildServices(connection, config);

  const authController = buildAuthController(services, config, logger);
  const userController = new UserController(
    new GetCurrentUserUseCaseImpl(services.userRepository, services.credentialRepository),
  );
  const authMiddleware = buildAuthMiddleware(services.tokenProvider);

  const app = buildHttpApp(authController, userController, authMiddleware, logger);

  app.listen(config.port, () => {
    logger.info("Serveur démarré", { port: config.port });
  });
}

// Démarre le serveur uniquement lorsque ce fichier est exécuté directement
// (et non lorsqu'il est importé, par ex. par les tests d'intégration qui réutilisent
// `buildHttpApp` sans ouvrir de connexion MySQL).
if (require.main === module) {
  void bootstrap().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Échec du démarrage de l'application :", error);
    process.exit(1);
  });
}
```

Notes sur ce nouveau `main.ts` :
- `buildServices` a 2 paramètres (`connection`, `config`) — bien sous la limite de 6.
- `buildAuthController` a 3 paramètres (`services`, `config`, `logger`) — bien sous 6.
- L'interface `AuthServices` utilise `ReturnType<>` pour typer les repos sans importer leurs types concrets directement — si cela pose un souci lint (type non nommé), on peut typer explicitement avec les interfaces de port. Vérifier après `npx tsc --noEmit`.
- Zéro double instanciation. Le commentaire d'excuse a disparu.

---

## Task 11: tsc + tests + lint (filet de sécurité tâche B)

- [ ] **Step 1: Vérifier la compilation TypeScript**

```powershell
npx tsc --noEmit
```

Expected: 0 erreur.

**Si erreur sur `ReturnType<typeof createAuthRepositories>` :** remplacer les types dans l'interface `AuthServices` par les types concrets importés explicitement. Exemples :
```typescript
import type { UserRepositoryPort } from "@application/features/auth/abstractions/repositories/UserRepositoryPort";
import type { CredentialRepositoryPort } from "@application/features/auth/abstractions/repositories/CredentialRepositoryPort";
import type { RefreshTokenRepositoryPort } from "@application/features/auth/abstractions/repositories/RefreshTokenRepositoryPort";
```
puis dans l'interface :
```typescript
interface AuthServices {
  userRepository: UserRepositoryPort;
  credentialRepository: CredentialRepositoryPort;
  refreshTokenRepository: RefreshTokenRepositoryPort;
  // ... reste inchangé
}
```

- [ ] **Step 2: Lancer les tests**

```powershell
npm test
```

Expected: 73 tests passed.

- [ ] **Step 3: Lancer le linter**

```powershell
npm run lint
```

Expected: 0 warnings.

- [ ] **Step 4: Lancer le build complet**

```powershell
npm run build
```

Expected: pas d'erreur, dossier `dist/` généré.

---

## Task 12: Commit B

- [ ] **Step 1: Stager et commiter**

```powershell
git add -A
git commit -m "refactor(main): build services once in composition root"
```

Expected: commit créé avec SHA. `git log --oneline -3` montre les 2 nouveaux commits.

---

## Self-Review

### 1. Couverture spec

| Exigence spec | Tâche couvrant |
|---|---|
| git mv avec préservation d'historique | Tasks 2–3 |
| Mise à jour imports dans fichiers déplacés | Task 4 |
| Mise à jour imports main.ts | Task 5 |
| Mise à jour imports tests | Task 6 |
| Vérification aucun ancien chemin | Task 7 |
| tsc 0, npm test 73 verts, lint 0, build OK | Tasks 8 + 11 |
| 2 commits séparés (A puis B) | Tasks 9 + 12 |
| buildServices — 1 seule instanciation | Task 10 |
| buildHttpApp signature conservée | Task 10 (signature inchangée) |
| parameter-count max 6 respecté | Task 10 (2 et 3 params) |
| Commentaires JSDoc français | Task 10 (présents dans le code) |

### 2. Placeholders

Aucun "TBD" ou "TODO" dans ce plan. Le code complet de `main.ts` est fourni en Task 10.

### 3. Cohérence des types

- `AuthController` importé depuis le nouveau chemin dans `main.ts` et dans les tests.
- `buildAuthMiddleware` consomme `services.tokenProvider` (instance de `TokenProviderServiceImpl` qui implémente `TokenProviderService`).
- Le type retourné par `buildAuthController` est `AuthController` — inchangé.
- `buildHttpApp` conserve exactement la même signature — les tests d'intégration l'appellent directement sans changement de signature.
