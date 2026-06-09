# Design — UnitOfWork transactionnel (brique d'architecture)

**Date** : 2026-06-09
**Statut** : validé, prêt pour implémentation
**Repo** : E-JDR-Backend (Node.js / TypeScript, Clean Architecture)

## Objectif

Faire du `UnitOfWork` (UoW) le **point d'entrée unique de toute écriture** en base.
Toute opération qui mute l'état (insert / update / delete) s'exécute dans un
`unitOfWork.execute(...)`, garantissant l'atomicité : tout réussit, ou rien n'est
écrit (commit / rollback global). Les lectures pures restent libres (hors UoW).

Cette brique corrige un bug existant (`RegisterUserUseCase` persiste `User` puis
`Credential` sans transaction → état incohérent possible) et pose le socle
transactionnel sur lequel les futurs domaines — à commencer par l'agrégat riche
`Campaign` (`addPlayer`) — devront s'appuyer.

## Règle d'architecture (convention d'équipe)

> Un use case qui **écrit** ouvre un `UnitOfWork`. Il n'injecte plus de repository
> pour écrire — il obtient les repos transactionnels fournis au callback.
> Les **lectures pures** (`existsByEmail`, `findById`, …) peuvent utiliser les repos
> injectés classiques, hors UoW (pas besoin d'atomicité pour lire).

Tout nouveau domaine (campaign, etc.) doit se conformer à cette règle.

## Flux

```
UseCase
  └─ unitOfWork.execute(async (repos) => {
         await repos.users.save(user)
         await repos.credentials.save(credential)
       })                                    ← atomique : commit ou rollback global

MysqlUnitOfWork.execute()
  ├─ pool.getConnection()
  ├─ conn.beginTransaction()
  ├─ createAuthRepositories(conn)   ← repos liés à CETTE connexion
  ├─ work(repos)                     ← le callback métier
  ├─ conn.commit()   (ou rollback si le callback throw)
  └─ conn.release()  (finally)
```

La couche application ne voit qu'une interface `IUnitOfWork` + un bundle de repos.
Aucune connaissance de MySQL ne fuite dans l'application.

## Composants

### 1. `SqlExecutor` — type infra partagé
`src/infrastructure/persistence/mysql/SqlExecutor.ts`

```ts
import { Pool } from "mysql2/promise";

/** Partie commune de Pool et PoolConnection dont les DAO ont besoin. */
export type SqlExecutor = Pick<Pool, "execute" | "query">;
```

`Pool` (mode normal) et `PoolConnection` (mode transactionnel) satisfont tous deux
ce type. Les DAO l'acceptent → un seul code DAO pour les deux modes.

### 2. Port `IUnitOfWork` — application
`src/application/shared/IUnitOfWork.ts`

```ts
export interface TransactionalRepositories {
  readonly users: IUserRepository;
  readonly credentials: ICredentialRepository;
  readonly refreshTokens: IRefreshTokenRepository;
}

export interface IUnitOfWork {
  execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}
```

Le bundle expose les repos **au besoin** (principe YAGNI) : aujourd'hui les 3 de
l'auth ; campaign y ajoutera `campaigns`, `players`.

### 3. Factory de repos
`src/infrastructure/persistence/mysql/auth/createAuthRepositories.ts`

```ts
export function createAuthRepositories(executor: SqlExecutor): TransactionalRepositories {
  return {
    users: new MysqlUserRepository(new UserDao(executor)),
    credentials: new MysqlCredentialRepository(new CredentialDao(executor)),
    refreshTokens: new MysqlRefreshTokenRepository(new RefreshTokenDao(executor)),
  };
}
```

**Un seul endroit** qui construit les repos. Utilisé par `main.ts` (sur le pool)
ET par le UoW (sur la connexion transactionnelle). Zéro duplication.

### 4. Implémentation MySQL
`src/infrastructure/persistence/mysql/MysqlUnitOfWork.ts`

```ts
export class MysqlUnitOfWork implements IUnitOfWork {
  constructor(private readonly connection: MysqlConnection) {}

  async execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
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

### 5. `FakeUnitOfWork` — tests
`tests/application/fakes.ts`

```ts
export class FakeUnitOfWork implements IUnitOfWork {
  constructor(private readonly repos: TransactionalRepositories) {}
  // Pas de vraie transaction : exécute le callback avec les fakes en mémoire.
  execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}
```

Les tests de use case restent triviaux (aucune DB).

## Impact sur le code existant

### DAO — changement minimal (signature)
`UserDao`, `CredentialDao`, `RefreshTokenDao` : `constructor(pool: Pool)` →
`constructor(executor: SqlExecutor)`. Le corps est inchangé (`SqlExecutor` expose
`.execute()` / `.query()`). Aucune logique SQL modifiée.

### Use cases auth — écritures via le UoW

| Use case | Écritures | Après |
|---|---|---|
| `RegisterUserUseCase` | `users.save` + `credentials.save` (bug) | les 2 dans un `execute()` atomique |
| `RefreshAccessTokenUseCase` | delete ancien token + insert nouveau (rotation) | les 2 dans un `execute()` atomique |
| `LoginUserUseCase` | `credentials.update` (lockout) | 1 write dans `execute()` |
| `LogoutUserUseCase` | `refreshTokens.delete` | 1 write dans `execute()` |

Les lectures (`existsByEmail`, `findByEmail`, `findById`, `findByTokenHash`)
restent sur les repos injectés classiques, hors UoW.

Exemple `RegisterUserUseCase` :

```ts
// AVANT (non atomique)
await this.userRepository.save(user);
await this.credentialRepository.save(credential);

// APRÈS
await this.unitOfWork.execute(async (repos) => {
  await repos.users.save(user);
  await repos.credentials.save(credential);
});
```

### Câblage `main.ts`
`buildAuthRepositories` est remplacé par la factory `createAuthRepositories(pool)`.
On instancie `new MysqlUnitOfWork(connection)` et on l'injecte dans les 4 use cases.
Les use cases gardent les repos injectés uniquement pour leurs **lectures**.

## Tests & validation

- `FakeUnitOfWork` ajouté à `tests/application/fakes.ts`.
- Tests des 4 use cases adaptés : injection de `FakeUnitOfWork` pour les écritures
  (restent sans DB).
- Nouveau test ciblé : un échec au milieu du callback propage l'erreur (au niveau du
  fake, vérifier que l'exception remonte sans valider les writes partiels).
- Validation : `npm run lint`, `npm run build` (typecheck strict du `SqlExecutor`),
  `npm run test:coverage` (60 tests existants + nouveaux, seuil 70%), format Prettier.

## Documentation

Mise à jour de la section architecture du `README.md` : ajout du `UnitOfWork` comme
brique transversale, la règle d'architecture ("toute écriture passe par le UoW,
lectures pures libres"), le pattern de factory de repos, et la mention que tout
futur domaine doit s'y conformer.

## Hors périmètre (YAGNI)

- Transactions imbriquées / nested UoW.
- UoW pour les lectures.
- Abstraction générique multi-domaines : la factory `createAuthRepositories` sera
  rejointe par `createCampaignRepositories` quand campaign arrivera, sans
  généralisation prématurée.

## Limite assumée

L'atomicité réelle MySQL (commit/rollback sur vraie connexion) n'est pas couverte
par les tests unitaires sans DB. Elle est vérifiable en test d'intégration DB —
non ajouté maintenant (pas de DB en CI).
