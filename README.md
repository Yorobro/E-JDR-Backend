# E-JDR Backend

Backend Node.js + TypeScript construit en **Clean Architecture** stricte.

## Architecture

Le projet est découpé en 4 couches avec une règle de dépendance stricte :

```
presentation ─┐
              ├──► application ──► domain
infrastructure┘
```

- **`domain`** — entités riches, value objects, erreurs métier. Ne dépend de **rien** (ni autre couche, ni lib npm). C'est ici que vivent les **invariants métier** : voir [Domaine riche](#domaine-riche).
- **`application`** — interfaces (ports), use cases, services, commands, erreurs applicatives. Dépend **uniquement** de `domain`.
- **`infrastructure`** — implémentations concrètes des ports (MySQL, bcrypt, JWT). Dépend de `application` (+ `domain`).
- **`presentation`** — Express : controllers, routes, middlewares, mappers HTTP. Dépend de `application` (+ `domain`).

Le fichier `src/main.ts` est le **composition root** : le seul endroit qui instancie les classes concrètes et les injecte.

### Règles de conception

- Un **use case** ne peut **pas** appeler un autre use case.
- Les **services** peuvent s'appeler entre eux ; ils factorisent la logique redondante entre use cases.
- Les **use cases** font de l'orchestration pure. **Toute écriture passe par le `UnitOfWork`** (atomicité) ; les lectures pures peuvent utiliser les repositories injectés directement. Voir [UnitOfWork](#unitofwork).
- **DAO = SQL pur** (1 DAO = 1 table) ; **Repository = assemblage** (DAO + mapping vers le domaine).
- Erreurs : `Result<T, E>` pour le métier attendu, exceptions pour le technique imprévu.
- Les **invariants métier** (validation, règles de robustesse, verrouillage…) sont encodés dans les entités et value objects du domaine, pas dans les use cases. Un objet invalide ne peut pas exister : si `Email.create("x")` lève une `DomainError`, c'est parce qu'un e-mail invalide est une impossibilité métier, pas une erreur technique.

### Modèle de données — authentification séparée du métier

L'identité **métier** et les données d'**authentification** sont volontairement scindées :

| Table | Responsabilité | Colonnes |
|---|---|---|
| `users` | Identité applicative (enrichie par le métier JDR à venir : pseudo, avatar…). | `id`, `created_at` |
| `credentials` | Authentification : e-mail + empreinte du mot de passe, reliés 1–1 à un `user`. Protection anti-brute-force intégrée. | `id`, `user_id` (FK→users, UNIQUE), `email` (UNIQUE), `password_hash`, `created_at`, `failed_attempts`, `locked_until` |
| `refresh_tokens` | Sessions révocables rattachées à un `user`. | `id`, `user_id` (FK→users), `token_hash`, `expires_at`, `created_at` |

Côté domaine, cela donne deux entités : `User` (identité, sans e-mail ni mot de passe) et
`Credential` (e-mail + hash + `userId`, porte la vérification du mot de passe). Le métier
évolue ainsi sans toucher au modèle de sécurité, et inversement. Le contrat HTTP reste
inchangé : `register`/`login` renvoient toujours `{ userId, email }`.

## Domaine riche

Le domaine suit le principe du **modèle riche** (rich domain model) : les entités et value objects ne sont pas de simples conteneurs de données — ils portent les règles métier et garantissent leurs propres invariants.

### Ce que ça signifie concrètement

**Un objet invalide ne peut pas exister.** La construction passe toujours par une factory (`create()`, `fromHash()`, `restore()`). Si l'entrée viole une règle métier, une `DomainError` est levée immédiatement — pas de retour `null`, pas de champ `isValid`.

```ts
Email.create("pas-un-email")       // → lève InvalidEmailError
PlainPassword.create("abc")        // → lève WeakPasswordError (trop court)
PlainPassword.create("abcdefgh")   // → lève WeakPasswordError (pas de chiffre/spécial)
HashedPassword.fromHash("")        // → lève InvalidHashError
```

**Les règles métier vivent dans l'entité qui les concerne.** L'anti-brute-force n'est pas dans un middleware ni dans un use case — il est dans `Credential` :

```ts
credential.isLocked(now)              // règle : lockedUntil !== null && now < lockedUntil
credential.recordFailedAttempt(now)   // règle : après 5 échecs → verrouillage 15 min
credential.resetFailedAttempts()      // règle : connexion réussie → compteur remis à zéro
```

**Les entités sont immuables de l'extérieur.** Aucun setter. Les méthodes qui changent l'état retournent une nouvelle instance (`recordFailedAttempt` et `resetFailedAttempts` retournent un nouveau `Credential`).

**Les dépendances techniques sont injectées, jamais importées.** `Credential.verifyPassword()` prend une fonction de comparaison en paramètre (`PasswordCompareFn`) : l'entité sait *que* le mot de passe doit être vérifié, mais ignore *comment* bcrypt fonctionne.

### Ce qui reste hors du domaine

Le domaine ne contient aucun `import` vers une lib npm. HTTP, bcrypt, JWT, MySQL vivent dans `infrastructure` et `presentation`. Les use cases dans `application` orchestrent le domaine sans y introduire de logique métier.

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

## Authentification

Stratégie : **JWT access token court** + **refresh token stocké en BDD** (révocable), transportés via **cookies httpOnly**.

| Endpoint | Méthode | Description |
|---|---|---|
| `/auth/register` | POST | Crée un compte et connecte directement (pose les cookies). |
| `/auth/login` | POST | Authentifie et pose les cookies access + refresh. |
| `/auth/refresh` | POST | Régénère l'access token (rotation du refresh) à partir du cookie refresh. |
| `/auth/logout` | POST | Révoque le refresh token en BDD et efface les cookies. |

## Démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer les tests unitaires (aucune BDD requise)
npm run test

# 3. Configurer l'environnement
cp .env.example .env   # puis renseigner les accès MySQL et les secrets JWT

# 4. Appliquer les migrations (crée les tables)
npm run db:migrate

# 5. Démarrer le serveur en développement
npm run dev
```

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Démarre le serveur avec rechargement à chaud. |
| `npm run build` | Compile le TypeScript vers `dist/`. |
| `npm start` | Démarre la version compilée. |
| `npm run test` | Exécute les tests (unitaires + intégration HTTP). |
| `npm run test:coverage` | Exécute les tests et vérifie les seuils de couverture. |
| `npm run lint` | Analyse statique ESLint (zéro avertissement toléré). |
| `npm run format` / `npm run format:check` | Applique / vérifie le formatage Prettier. |
| `npm run db:generate` | Génère une migration SQL à partir du schema Drizzle modifié. |
| `npm run db:migrate` | Applique les migrations Drizzle en attente. |
| `npm run db:custom -- --name=<desc>` | Crée une migration SQL vide à écrire à la main (transformations de données). |

> **Migrations forward-only** — Le projet n'applique pas de rollback automatique : annuler
> en supprimant la seule trace, sans défaire le DDL, laisserait la base incohérente. Pour
> revenir en arrière, on écrit une nouvelle migration correctrice (via `npm run db:custom`).
> Les conventions complètes (workflow auto/custom, baseline) sont décrites dans
> [`db/MIGRATION.md`](db/MIGRATION.md).
