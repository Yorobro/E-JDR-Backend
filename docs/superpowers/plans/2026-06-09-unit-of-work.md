# UnitOfWork transactionnel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire du `UnitOfWork` le point d'entrée unique de toute écriture en base (atomicité commit/rollback), et y conformer les 4 use cases auth.

**Architecture:** Port `IUnitOfWork` (application) avec callback recevant un bundle de repos transactionnels. Implémentation MySQL ouvre une `PoolConnection`, `beginTransaction`, construit les repos via une factory partagée sur cette connexion, exécute le callback, `commit`/`rollback`. Les DAO acceptent un `SqlExecutor` (commun à `Pool` et `PoolConnection`).

**Tech Stack:** Node.js 22, TypeScript strict, mysql2/promise, Vitest, Express.

---

## Notes de contexte

- Le projet utilise des alias d'import : `@application/*`, `@infrastructure/*`, `@domain/*`, `@config/*`.
- `Result<T,E>` (railway) : `Result.success(v)` / `Result.failure(e)`.
- Tests : `npm run test` (Vitest). Lancer un seul fichier : `npx vitest run tests/chemin/fichier.test.ts`.
- Commits : format conventional commit obligatoire (hook commitlint actif). Co-author requis.
- Branche de travail : `feat/unit-of-work` (déjà créée).
- **Subtilité refresh** : la rotation du refresh token = `deleteByTokenHash` (dans le use case) + `save` (à l'intérieur de `AuthTokenService.issueTokens`). Pour les rendre atomiques, `issueTokens` recevra un paramètre optionnel `refreshTokenRepo` ; quand fourni, il l'utilise au lieu du repo injecté. Le use case refresh appellera `issueTokens(..., repos.refreshTokens)` dans le `execute()`.

---

## Task 1: Type `SqlExecutor`

**Files:**
- Create: `src/infrastructure/persistence/mysql/SqlExecutor.ts`

- [ ] **Step 1: Créer le type**

```ts
import { Pool } from "mysql2/promise";

/**
 * Partie commune de `Pool` et `PoolConnection` dont les DAO ont besoin.
 *
 * Les DAO acceptent ce type au lieu d'un `Pool` strict : ils peuvent ainsi exécuter
 * leurs requêtes aussi bien sur le pool (mode normal) que sur une connexion unique
 * ouverte pour une transaction (mode UnitOfWork). Les deux exposent `execute`/`query`.
 */
export type SqlExecutor = Pick<Pool, "execute" | "query">;
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npm run build`
Expected: PASS (pas d'erreur de type).

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/mysql/SqlExecutor.ts
git commit -m "feat(persistence): add SqlExecutor type for pool/connection abstraction"
```

---

## Task 2: DAO acceptent un `SqlExecutor`

**Files:**
- Modify: `src/infrastructure/persistence/mysql/auth/dao/UserDao.ts`
- Modify: `src/infrastructure/persistence/mysql/auth/dao/CredentialDao.ts`
- Modify: `src/infrastructure/persistence/mysql/auth/dao/RefreshTokenDao.ts`

- [ ] **Step 1: UserDao — remplacer `Pool` par `SqlExecutor`**

Dans `UserDao.ts`, remplacer l'import `import { Pool, RowDataPacket } from "mysql2/promise";` par :

```ts
import { RowDataPacket } from "mysql2/promise";
import { SqlExecutor } from "@infrastructure/persistence/mysql/SqlExecutor";
```

Et le constructeur `constructor(private readonly pool: Pool) {}` par :

```ts
  constructor(private readonly executor: SqlExecutor) {}
```

Puis remplacer **toutes** les occurrences de `this.pool.execute` par `this.executor.execute` dans le fichier.

- [ ] **Step 2: CredentialDao — idem**

Même transformation dans `CredentialDao.ts` : import `Pool` retiré, ajout de `SqlExecutor`, `constructor(private readonly executor: SqlExecutor) {}`, et `this.pool.execute` → `this.executor.execute` partout.

- [ ] **Step 3: RefreshTokenDao — idem**

Même transformation dans `RefreshTokenDao.ts`.

- [ ] **Step 4: Adapter le câblage temporairement dans main.ts**

Dans `src/main.ts`, la fonction `buildAuthRepositories` passe déjà `pool` aux DAO. Comme `Pool` satisfait `SqlExecutor`, **aucun changement nécessaire ici** : vérifier que ça compile tel quel.

- [ ] **Step 5: Vérifier compilation + tests**

Run: `npm run build && npm run test`
Expected: PASS (60 tests verts ; les DAO ne sont pas testés unitairement mais la compilation valide les signatures).

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/persistence/mysql/auth/dao/
git commit -m "refactor(persistence): DAO accept SqlExecutor instead of Pool"
```

---

## Task 3: Port `IUnitOfWork` + `TransactionalRepositories`

**Files:**
- Create: `src/application/shared/IUnitOfWork.ts`

- [ ] **Step 1: Créer le port**

```ts
import { IUserRepository } from "@application/auth/abstractions/repositories/IUserRepository";
import { ICredentialRepository } from "@application/auth/abstractions/repositories/ICredentialRepository";
import { IRefreshTokenRepository } from "@application/auth/abstractions/repositories/IRefreshTokenRepository";

/**
 * Jeu de repositories liés à une même transaction, fournis au callback d'un `UnitOfWork`.
 *
 * Exposé « au besoin » : seuls les repos réellement utilisés dans des écritures
 * transactionnelles figurent ici. Un nouveau domaine (ex. campaign) ajoutera ses repos.
 */
export interface TransactionalRepositories {
  readonly users: IUserRepository;
  readonly credentials: ICredentialRepository;
  readonly refreshTokens: IRefreshTokenRepository;
}

/**
 * Port « out » d'unité de travail (Unit of Work).
 *
 * Règle d'architecture : **toute écriture** en base passe par `execute()`. Le callback
 * reçoit des repos liés à la transaction ; s'il lève, tout est annulé (rollback global),
 * sinon tout est validé (commit). Les lectures pures n'ont pas besoin du UnitOfWork.
 */
export interface IUnitOfWork {
  execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}
```

- [ ] **Step 2: Vérifier compilation**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/application/shared/IUnitOfWork.ts
git commit -m "feat(application): add IUnitOfWork port and TransactionalRepositories"
```

---

## Task 4: Factory de repos `createAuthRepositories`

**Files:**
- Create: `src/infrastructure/persistence/mysql/auth/createAuthRepositories.ts`

- [ ] **Step 1: Créer la factory**

```ts
import { SqlExecutor } from "@infrastructure/persistence/mysql/SqlExecutor";
import { TransactionalRepositories } from "@application/shared/IUnitOfWork";
import { UserDao } from "@infrastructure/persistence/mysql/auth/dao/UserDao";
import { CredentialDao } from "@infrastructure/persistence/mysql/auth/dao/CredentialDao";
import { RefreshTokenDao } from "@infrastructure/persistence/mysql/auth/dao/RefreshTokenDao";
import { MysqlUserRepository } from "@infrastructure/persistence/mysql/auth/repository/MysqlUserRepository";
import { MysqlCredentialRepository } from "@infrastructure/persistence/mysql/auth/repository/MysqlCredentialRepository";
import { MysqlRefreshTokenRepository } from "@infrastructure/persistence/mysql/auth/repository/MysqlRefreshTokenRepository";

/**
 * Construit le jeu de repositories auth sur un `SqlExecutor` donné.
 *
 * Point unique de construction des repos : utilisé par le composition root (`main.ts`,
 * sur le pool) ET par le `MysqlUnitOfWork` (sur une connexion transactionnelle). Garantit
 * que les deux modes produisent exactement les mêmes repos, sans duplication de câblage.
 */
export function createAuthRepositories(executor: SqlExecutor): TransactionalRepositories {
  return {
    users: new MysqlUserRepository(new UserDao(executor)),
    credentials: new MysqlCredentialRepository(new CredentialDao(executor)),
    refreshTokens: new MysqlRefreshTokenRepository(new RefreshTokenDao(executor)),
  };
}
```

- [ ] **Step 2: Vérifier compilation**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/mysql/auth/createAuthRepositories.ts
git commit -m "feat(persistence): add createAuthRepositories factory"
```

---

## Task 5: Implémentation `MysqlUnitOfWork`

**Files:**
- Create: `src/infrastructure/persistence/mysql/MysqlUnitOfWork.ts`

- [ ] **Step 1: Créer l'implémentation**

```ts
import { MysqlConnection } from "@infrastructure/persistence/mysql/MysqlConnection";
import { createAuthRepositories } from "@infrastructure/persistence/mysql/auth/createAuthRepositories";
import { IUnitOfWork, TransactionalRepositories } from "@application/shared/IUnitOfWork";

/**
 * Implémentation MySQL du `UnitOfWork`.
 *
 * Ouvre une connexion dédiée depuis le pool, démarre une transaction, construit les repos
 * liés à cette connexion, exécute le callback, puis valide (commit) ou annule (rollback)
 * selon que le callback réussit ou lève. La connexion est toujours rendue au pool (finally).
 */
export class MysqlUnitOfWork implements IUnitOfWork {
  constructor(private readonly connection: MysqlConnection) {}

  public async execute<T>(
    work: (repos: TransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const conn = await this.connection.getPool().getConnection();
    await conn.beginTransaction();
    try {
      const result = await work(createAuthRepositories(conn));
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}
```

- [ ] **Step 2: Vérifier compilation**

Run: `npm run build`
Expected: PASS. (Note : `conn` est une `PoolConnection`, qui satisfait `SqlExecutor` ; `createAuthRepositories(conn)` compile.)

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/persistence/mysql/MysqlUnitOfWork.ts
git commit -m "feat(persistence): add MysqlUnitOfWork with commit/rollback"
```

---

## Task 6: `FakeUnitOfWork` pour les tests

**Files:**
- Modify: `tests/application/fakes.ts`

- [ ] **Step 1: Ajouter l'import du port en haut de `fakes.ts`**

Ajouter, avec les autres imports `@application` :

```ts
import { IUnitOfWork, TransactionalRepositories } from "@application/shared/IUnitOfWork";
```

- [ ] **Step 2: Ajouter la classe à la fin de `fakes.ts` (avant les helpers `buildTestUser`)**

```ts
/**
 * UnitOfWork factice : exécute le callback avec un bundle de repos en mémoire, sans
 * vraie transaction. Si le callback lève, l'erreur remonte telle quelle (les fakes ne
 * « rollback » pas, mais le test peut vérifier la propagation de l'erreur).
 */
export class FakeUnitOfWork implements IUnitOfWork {
  constructor(private readonly repos: TransactionalRepositories) {}

  public execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}

/**
 * Aide de test : assemble un `TransactionalRepositories` à partir de fakes.
 * Réutilise les fakes fournis pour que le test puisse inspecter leur état après coup.
 */
export function buildFakeTransactionalRepositories(overrides?: {
  users?: FakeUserRepository;
  credentials?: FakeCredentialRepository;
  refreshTokens?: FakeRefreshTokenRepository;
}): TransactionalRepositories & {
  users: FakeUserRepository;
  credentials: FakeCredentialRepository;
  refreshTokens: FakeRefreshTokenRepository;
} {
  return {
    users: overrides?.users ?? new FakeUserRepository(),
    credentials: overrides?.credentials ?? new FakeCredentialRepository(),
    refreshTokens: overrides?.refreshTokens ?? new FakeRefreshTokenRepository(),
  };
}
```

- [ ] **Step 3: Écrire un test pour `FakeUnitOfWork`**

Create: `tests/application/FakeUnitOfWork.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestUser,
} from "./fakes";

describe("FakeUnitOfWork", () => {
  it("exécute le callback avec les repos fournis et retourne sa valeur", async () => {
    const repos = buildFakeTransactionalRepositories();
    const uow = new FakeUnitOfWork(repos);

    const user = buildTestUser("u-1");
    const result = await uow.execute(async (r) => {
      await r.users.save(user);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(await repos.users.findById("u-1")).not.toBeNull();
  });

  it("propage l'erreur si le callback lève", async () => {
    const repos = buildFakeTransactionalRepositories();
    const uow = new FakeUnitOfWork(repos);

    await expect(
      uow.execute(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 4: Lancer le test**

Run: `npx vitest run tests/application/FakeUnitOfWork.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/application/fakes.ts tests/application/FakeUnitOfWork.test.ts
git commit -m "test(application): add FakeUnitOfWork and its tests"
```

---

## Task 7: `RegisterUserUseCase` via UnitOfWork

**Files:**
- Modify: `src/application/auth/usecases/RegisterUserUseCase.ts`
- Modify: `tests/application/RegisterUserUseCase.test.ts`

- [ ] **Step 1: Adapter le test d'abord (TDD)**

Ouvrir `tests/application/RegisterUserUseCase.test.ts`. Le use case va remplacer ses deux paramètres `userRepository` et `credentialRepository` par : `credentialRepository` (gardé pour la lecture `existsByEmail`) + `unitOfWork`. Adapter l'instanciation du use case dans le test pour injecter un `FakeUnitOfWork` construit sur les mêmes fakes que ceux inspectés.

Remplacer la construction du use case par (exemple — adapter aux noms de variables existants du fichier) :

```ts
import {
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  FakeCredentialRepository,
  // ... autres fakes déjà importés
} from "./fakes";

// Dans le test / beforeEach :
const txRepos = buildFakeTransactionalRepositories();
const credentialRepository = txRepos.credentials; // partagé lecture + écriture
const unitOfWork = new FakeUnitOfWork(txRepos);

const useCase = new RegisterUserUseCase(
  credentialRepository,
  passwordHasher,
  idGenerator,
  authTokenService,
  unitOfWork,
  logger,
);
```

**Adapter aussi les assertions** : le test actuel utilise deux fakes séparés `userRepository`/`credentialRepository`. Les remplacer par `txRepos.users`/`txRepos.credentials`. Concrètement :
- `expect(await credentialRepository.existsByEmail(...))` → `expect(await txRepos.credentials.existsByEmail(...))`
- `expect(await userRepository.findById(...))` → `expect(await txRepos.users.findById(...))`
- Le `credentialRepository.seed(...)` du 2ᵉ test → `txRepos.credentials.seed(...)`

Supprimer les anciennes déclarations `let userRepository` / `new FakeUserRepository()` etc. devenues inutiles (remplacées par `txRepos`). Garder `authTokenService` (toujours injecté séparément) et ses assertions `issuedFor`.

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run tests/application/RegisterUserUseCase.test.ts`
Expected: FAIL (le constructeur de `RegisterUserUseCase` n'a pas encore cette signature → erreur de compilation/typage).

- [ ] **Step 3: Modifier le use case**

Dans `RegisterUserUseCase.ts` :

Remplacer les imports de repos par le port UoW. Retirer :
```ts
import { IUserRepository } from "@application/auth/abstractions/repositories/IUserRepository";
```
Ajouter :
```ts
import { IUnitOfWork } from "@application/shared/IUnitOfWork";
```
(Garder `ICredentialRepository` : il sert à la lecture `existsByEmail`.)

Remplacer le constructeur :

```ts
  constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly idGenerator: IIdGenerator,
    private readonly authTokenService: IAuthTokenService,
    private readonly unitOfWork: IUnitOfWork,
    private readonly logger: ILogger,
  ) {}
```

Remplacer les deux `save` séquentiels (lignes ~68-69) :

```ts
    await this.unitOfWork.execute(async (repos) => {
      await repos.users.save(user);
      await repos.credentials.save(credential);
    });
```

La lecture `existsByEmail` reste inchangée (via `this.credentialRepository`).

- [ ] **Step 4: Mettre à jour le câblage dans main.ts**

Dans `src/main.ts`, fonction `buildAuthController`, adapter l'instanciation de `RegisterUserUseCase`. Il faut un `unitOfWork`. Voir Task 11 pour le câblage complet ; pour l'instant, ajouter en tête de `buildAuthController` :

```ts
  const unitOfWork = new MysqlUnitOfWork(connection);
```

et l'import en haut de `main.ts` :

```ts
import { MysqlUnitOfWork } from "@infrastructure/persistence/mysql/MysqlUnitOfWork";
```

puis remplacer l'appel `new RegisterUserUseCase(...)` par :

```ts
  const registerUser = new RegisterUserUseCase(
    credentialRepository,
    passwordHasher,
    idGenerator,
    authTokenService,
    unitOfWork,
    logger,
  );
```

- [ ] **Step 5: Lancer le test + build**

Run: `npx vitest run tests/application/RegisterUserUseCase.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/application/auth/usecases/RegisterUserUseCase.ts tests/application/RegisterUserUseCase.test.ts src/main.ts
git commit -m "refactor(auth): RegisterUserUseCase writes via UnitOfWork (atomic user+credential)"
```

---

## Task 8: `LoginUserUseCase` via UnitOfWork

**Files:**
- Modify: `src/application/auth/usecases/LoginUserUseCase.ts`
- Modify: `tests/application/LoginUserUseCase.test.ts`

- [ ] **Step 1: Adapter le test (TDD)**

Dans `tests/application/LoginUserUseCase.test.ts`, le use case gardera `credentialRepository` pour la lecture `findByEmail` mais écrira (`update`) via le UoW. Construire un `FakeUnitOfWork` sur les mêmes fakes. Adapter l'instanciation :

```ts
import { FakeUnitOfWork, buildFakeTransactionalRepositories } from "./fakes";

const txRepos = buildFakeTransactionalRepositories();
const credentialRepository = txRepos.credentials;
const unitOfWork = new FakeUnitOfWork(txRepos);

const useCase = new LoginUserUseCase(
  credentialRepository,
  passwordHasher,
  authTokenService,
  unitOfWork,
  logger,
);
```

Les assertions existantes (compteur d'échecs, lockout, reset) inspectent `txRepos.credentials` après coup — conserver.

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run tests/application/LoginUserUseCase.test.ts`
Expected: FAIL (signature du constructeur).

- [ ] **Step 3: Modifier le use case**

Dans `LoginUserUseCase.ts`, ajouter l'import :
```ts
import { IUnitOfWork } from "@application/shared/IUnitOfWork";
```

Ajouter `unitOfWork` au constructeur (après `authTokenService`) :
```ts
  constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly authTokenService: IAuthTokenService,
    private readonly unitOfWork: IUnitOfWork,
    private readonly logger: ILogger,
  ) {}
```

Remplacer le `update` de l'échec (ligne ~74) :
```ts
      const failed = credential.recordFailedAttempt(now);
      await this.unitOfWork.execute((repos) => repos.credentials.update(failed));
```

Remplacer le `update` du succès (ligne ~82-83) :
```ts
    const updated = credential.resetFailedAttempts();
    await this.unitOfWork.execute((repos) => repos.credentials.update(updated));
```

La lecture `findByEmail` reste via `this.credentialRepository`.

- [ ] **Step 4: Mettre à jour le câblage main.ts**

Dans `src/main.ts`, remplacer `new LoginUserUseCase(...)` par :
```ts
  const loginUser = new LoginUserUseCase(
    credentialRepository,
    passwordHasher,
    authTokenService,
    unitOfWork,
    logger,
  );
```

- [ ] **Step 5: Lancer le test + build**

Run: `npx vitest run tests/application/LoginUserUseCase.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/application/auth/usecases/LoginUserUseCase.ts tests/application/LoginUserUseCase.test.ts src/main.ts
git commit -m "refactor(auth): LoginUserUseCase writes via UnitOfWork"
```

---

## Task 9: `LogoutUserUseCase` via UnitOfWork

**Files:**
- Modify: `src/application/auth/usecases/LogoutUserUseCase.ts`
- Modify: `tests/application/LogoutUserUseCase.test.ts`

- [ ] **Step 1: Adapter le test (TDD)**

Dans `tests/application/LogoutUserUseCase.test.ts`, le use case ne gardera plus `refreshTokenRepository` injecté pour l'écriture : il l'obtiendra du UoW. Adapter :

```ts
import { FakeUnitOfWork, buildFakeTransactionalRepositories } from "./fakes";

const txRepos = buildFakeTransactionalRepositories();
const unitOfWork = new FakeUnitOfWork(txRepos);

const useCase = new LogoutUserUseCase(tokenHasher, unitOfWork);
```

Les assertions inspectent `txRepos.refreshTokens` après coup.

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run tests/application/LogoutUserUseCase.test.ts`
Expected: FAIL (signature du constructeur).

- [ ] **Step 3: Modifier le use case**

Réécrire `LogoutUserUseCase.ts` :

```ts
import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { LogoutUserCommand } from "@application/auth/commands/LogoutUserCommand";
import { ILogoutUserUseCase } from "@application/auth/abstractions/usecases/ILogoutUserUseCase";
import { ITokenHasher } from "@application/auth/abstractions/services/ITokenHasher";
import { IUnitOfWork } from "@application/shared/IUnitOfWork";

/**
 * Use case de déconnexion.
 *
 * Révoque le refresh token côté serveur en supprimant son empreinte de la base, via le
 * `UnitOfWork`. L'opération est **idempotente** — révoquer un token déjà absent réussit.
 */
export class LogoutUserUseCase implements ILogoutUserUseCase {
  constructor(
    private readonly tokenHasher: ITokenHasher,
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  public async execute(command: LogoutUserCommand): Promise<Result<void, AppError>> {
    const tokenHash = this.tokenHasher.hash(command.refreshToken);
    await this.unitOfWork.execute((repos) => repos.refreshTokens.deleteByTokenHash(tokenHash));

    return Result.success(undefined);
  }
}
```

- [ ] **Step 4: Mettre à jour le câblage main.ts**

Dans `src/main.ts`, remplacer `new LogoutUserUseCase(refreshTokenRepository, tokenHasher)` par :
```ts
  const logoutUser = new LogoutUserUseCase(tokenHasher, unitOfWork);
```

- [ ] **Step 5: Lancer le test + build**

Run: `npx vitest run tests/application/LogoutUserUseCase.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/application/auth/usecases/LogoutUserUseCase.ts tests/application/LogoutUserUseCase.test.ts src/main.ts
git commit -m "refactor(auth): LogoutUserUseCase writes via UnitOfWork"
```

---

## Task 10: `AuthTokenService.issueTokens` accepte un repo transactionnel + `RefreshAccessTokenUseCase` atomique

**Files:**
- Modify: `src/application/auth/abstractions/services/IAuthTokenService.ts`
- Modify: `src/application/auth/services/AuthTokenService.ts`
- Modify: `src/application/auth/usecases/RefreshAccessTokenUseCase.ts`
- Modify: `tests/application/RefreshAccessTokenUseCase.test.ts`
- Modify: `tests/application/fakes.ts` (FakeAuthTokenService)

**Contexte :** la rotation = delete (use case) + insert (dans `issueTokens`). Pour les rendre atomiques, `issueTokens` reçoit un `IRefreshTokenRepository` optionnel ; le use case refresh appelle delete + `issueTokens(..., repos.refreshTokens)` dans un même `execute()`.

- [ ] **Step 1: Étendre l'interface `IAuthTokenService`**

Dans `IAuthTokenService.ts`, modifier la signature de `issueTokens` pour ajouter un paramètre optionnel. Ajouter l'import :
```ts
import { IRefreshTokenRepository } from "@application/auth/abstractions/repositories/IRefreshTokenRepository";
```
et la nouvelle signature :
```ts
  issueTokens(
    userId: string,
    email: string,
    refreshTokenRepo?: IRefreshTokenRepository,
  ): Promise<AuthTokens>;
```

- [ ] **Step 2: Adapter l'implémentation `AuthTokenService`**

Dans `AuthTokenService.ts`, modifier `issueTokens` et `persistRefreshToken` pour utiliser le repo fourni s'il existe, sinon celui injecté :

```ts
  public async issueTokens(
    userId: string,
    email: string,
    refreshTokenRepo?: IRefreshTokenRepository,
  ): Promise<AuthTokens> {
    const payload = { userId, email };

    const accessToken = this.tokenProvider.signAccessToken(payload);
    const refreshToken = this.tokenProvider.signRefreshToken(payload);

    await this.persistRefreshToken(
      userId,
      refreshToken.token,
      refreshToken.expiresAt,
      refreshTokenRepo ?? this.refreshTokenRepository,
    );

    return {
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt: refreshToken.expiresAt,
    };
  }

  private async persistRefreshToken(
    userId: string,
    rawRefreshToken: string,
    expiresAt: Date,
    repo: IRefreshTokenRepository,
  ): Promise<void> {
    await repo.save({
      id: this.idGenerator.generate(),
      userId,
      tokenHash: this.tokenHasher.hash(rawRefreshToken),
      expiresAt,
    });
  }
```

- [ ] **Step 3: Adapter `FakeAuthTokenService` dans fakes.ts**

Mettre à jour la signature pour qu'elle reste compatible avec l'interface (le paramètre est ignoré par le fake) :

```ts
  public async issueTokens(
    userId: string,
    _email: string,
    _refreshTokenRepo?: IRefreshTokenRepository,
  ): Promise<AuthTokens> {
    this.issuedFor.push(userId);
    return {
      accessToken: `access-for-${userId}`,
      accessTokenExpiresAt: new Date("2999-01-01"),
      refreshToken: `refresh-for-${userId}`,
      refreshTokenExpiresAt: new Date("2999-01-01"),
    };
  }
```

(L'import `IRefreshTokenRepository` est déjà présent dans `fakes.ts`.)

- [ ] **Step 4: Adapter le test refresh (TDD)**

Dans `tests/application/RefreshAccessTokenUseCase.test.ts`, le use case gardera `userRepository`/`refreshTokenRepository` pour les **lectures** (`findById`, `findByTokenHash`) mais fera la rotation (delete + issueTokens) via le UoW. Construire un `FakeUnitOfWork` sur les mêmes fakes. Adapter l'instanciation :

```ts
import { FakeUnitOfWork, buildFakeTransactionalRepositories } from "./fakes";

const txRepos = buildFakeTransactionalRepositories();
const userRepository = txRepos.users;
const refreshTokenRepository = txRepos.refreshTokens;
const unitOfWork = new FakeUnitOfWork(txRepos);

const useCase = new RefreshAccessTokenUseCase(
  userRepository,
  refreshTokenRepository,
  tokenProvider,
  tokenHasher,
  authTokenService,
  unitOfWork,
);
```

Conserver les assertions existantes.

- [ ] **Step 5: Lancer le test pour le voir échouer**

Run: `npx vitest run tests/application/RefreshAccessTokenUseCase.test.ts`
Expected: FAIL (signature du constructeur).

- [ ] **Step 6: Modifier le use case refresh**

Dans `RefreshAccessTokenUseCase.ts` :

Ajouter l'import :
```ts
import { IUnitOfWork } from "@application/shared/IUnitOfWork";
```

Ajouter `unitOfWork` au constructeur (en dernier) :
```ts
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenProvider: ITokenProvider,
    private readonly tokenHasher: ITokenHasher,
    private readonly authTokenService: IAuthTokenService,
    private readonly unitOfWork: IUnitOfWork,
  ) {}
```

Remplacer le bloc rotation + émission (lignes ~66-70) par une transaction unique. Remplacer :
```ts
    await this.rotate(command.refreshToken);
    await this.purgeExpiredTokens();

    const tokens = await this.authTokenService.issueTokens(payload.userId, payload.email);
    return Result.success({ tokens });
```
par :
```ts
    const tokens = await this.unitOfWork.execute(async (repos) => {
      const oldTokenHash = this.tokenHasher.hash(command.refreshToken);
      await repos.refreshTokens.deleteByTokenHash(oldTokenHash);
      return this.authTokenService.issueTokens(payload.userId, payload.email, repos.refreshTokens);
    });

    await this.purgeExpiredTokens();

    return Result.success({ tokens });
```

Supprimer la méthode privée `rotate` (désormais inlinée dans la transaction). Conserver `purgeExpiredTokens` (best-effort, hors transaction) et `isRefreshTokenStored`.

- [ ] **Step 7: Mettre à jour le câblage main.ts**

Dans `src/main.ts`, remplacer `new RefreshAccessTokenUseCase(...)` par :
```ts
  const refreshAccessToken = new RefreshAccessTokenUseCase(
    userRepository,
    refreshTokenRepository,
    tokenProvider,
    tokenHasher,
    authTokenService,
    unitOfWork,
  );
```

- [ ] **Step 8: Lancer le test + build**

Run: `npx vitest run tests/application/RefreshAccessTokenUseCase.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/application/auth/ tests/application/ src/main.ts
git commit -m "refactor(auth): atomic refresh token rotation via UnitOfWork"
```

---

## Task 11: Nettoyage du câblage `main.ts`

**Files:**
- Modify: `src/main.ts`

**Contexte :** `buildAuthRepositories` construit encore les repos « à la main ». Le remplacer par la factory `createAuthRepositories(pool)` pour un point de construction unique.

- [ ] **Step 1: Remplacer `buildAuthRepositories` par la factory**

Dans `src/main.ts`, supprimer la fonction `buildAuthRepositories` et ses imports devenus inutiles (`UserDao`, `CredentialDao`, `RefreshTokenDao`, `MysqlUserRepository`, `MysqlCredentialRepository`, `MysqlRefreshTokenRepository`). Ajouter l'import :
```ts
import { createAuthRepositories } from "@infrastructure/persistence/mysql/auth/createAuthRepositories";
```

Dans `buildAuthController`, remplacer :
```ts
  const { userRepository, credentialRepository, refreshTokenRepository } =
    buildAuthRepositories(connection);
```
par :
```ts
  const { users: userRepository, credentials: credentialRepository, refreshTokens: refreshTokenRepository } =
    createAuthRepositories(connection.getPool());
```

(Le `MysqlUnitOfWork` est déjà instancié dans `buildAuthController` depuis la Task 7.)

- [ ] **Step 2: Build + suite complète**

Run: `npm run build && npm run test`
Expected: PASS (tous les tests, 60+ nouveaux).

- [ ] **Step 3: Lint + format**

Run: `npm run lint && npm run format`
Expected: lint OK ; format applique le style si besoin.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "refactor(main): wire repositories via createAuthRepositories factory"
```

---

## Task 12: Mise à jour du README (architecture)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Mettre à jour la règle de conception (ligne ~26)**

Dans la section `### Règles de conception`, remplacer la puce :
```
- Les **use cases** font de l'orchestration pure et peuvent manipuler les repositories directement.
```
par :
```
- Les **use cases** font de l'orchestration pure. **Toute écriture passe par le `UnitOfWork`** (atomicité) ; les lectures pures peuvent utiliser les repositories injectés directement. Voir [UnitOfWork](#unitofwork).
```

- [ ] **Step 2: Ajouter une section `## UnitOfWork` après la section `## Domaine riche`**

Insérer avant la section `## Authentification` :

```markdown
## UnitOfWork

Toute **écriture** en base passe par le `UnitOfWork` (`IUnitOfWork`), qui garantit
l'**atomicité** : dans un même `execute(...)`, soit toutes les écritures réussissent
(commit), soit aucune n'est appliquée (rollback). Les **lectures pures** n'en ont pas
besoin et utilisent les repositories injectés directement.

```ts
await unitOfWork.execute(async (repos) => {
  await repos.users.save(user);
  await repos.credentials.save(credential); // les deux, ou rien
});
```

- **Port** : `IUnitOfWork` + `TransactionalRepositories` (`src/application/shared/IUnitOfWork.ts`) — la couche application ne connaît pas MySQL.
- **Implémentation** : `MysqlUnitOfWork` ouvre une connexion, `beginTransaction`, construit les repos sur cette connexion via `createAuthRepositories`, puis `commit`/`rollback`.
- **Factory de repos** : `createAuthRepositories(executor)` est le point unique de construction des repos, partagé entre le composition root (sur le pool) et le `UnitOfWork` (sur la connexion transactionnelle).
- **DAO** : acceptent un `SqlExecutor` (commun à `Pool` et `PoolConnection`), ce qui permet le même code en mode normal et transactionnel.

**Règle pour les nouveaux domaines** : tout domaine ajouté (ex. `campaign`) fournit sa
propre factory (`createCampaignRepositories`), enrichit `TransactionalRepositories` des
repos nécessaires, et écrit exclusivement via le `UnitOfWork`.
```

- [ ] **Step 3: Vérifier le format (README exclu de prettier)**

Le `.prettierignore` exclut `*.md` — pas de `format:check` à craindre. Relire visuellement la section.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): document UnitOfWork as write entry point"
```

---

## Task 13: Validation finale complète

- [ ] **Step 1: Suite complète + couverture**

Run: `npm run lint && npm run format:check && npm run test:coverage && npm run build`
Expected: tout PASS, seuil de couverture 70% tenu.

- [ ] **Step 2: Vérifier qu'aucun `save`/`update`/`delete` d'écriture ne subsiste hors UoW dans les use cases**

Run: `npx vitest run` puis relire les 4 use cases : aucune écriture (`.save`/`.update`/`.deleteByTokenHash`) ne doit subsister hors d'un `unitOfWork.execute(...)`. (Les lectures `findById`/`findByEmail`/`existsByEmail`/`findByTokenHash` et la purge best-effort `deleteExpired` restent hors UoW — la purge est une maintenance opportuniste non critique, volontairement non transactionnelle.)

- [ ] **Step 3: Commit final éventuel (si format a modifié des fichiers)**

```bash
git add -A
git commit -m "chore: final formatting after UnitOfWork integration" || echo "rien à committer"
```
```

---

## Décision laissée explicite

`deleteExpired` (purge best-effort dans le refresh) reste **hors** du UnitOfWork : c'est une maintenance opportuniste, non critique, dont l'échec ne doit pas annuler le refresh. C'est cohérent avec la règle « toute écriture *métier* passe par le UoW » — la purge n'est pas une écriture métier mais de l'entretien.
