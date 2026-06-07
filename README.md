# E-JDR Backend

Backend Node.js + TypeScript construit en **Clean Architecture** stricte.

## Architecture

Le projet est découpé en 4 couches avec une règle de dépendance stricte :

```
presentation ─┐
              ├──► application ──► domain
infrastructure┘
```

- **`domain`** — entités riches, value objects, erreurs métier. Ne dépend de **rien** (ni autre couche, ni lib npm).
- **`application`** — interfaces (ports), use cases, services, commands, erreurs applicatives. Dépend **uniquement** de `domain`.
- **`infrastructure`** — implémentations concrètes des ports (MySQL, bcrypt, JWT). Dépend de `application` (+ `domain`).
- **`presentation`** — Express : controllers, routes, middlewares, mappers HTTP. Dépend de `application` (+ `domain`).

Le fichier `src/main.ts` est le **composition root** : le seul endroit qui instancie les classes concrètes et les injecte.

### Règles de conception

- Un **use case** ne peut **pas** appeler un autre use case.
- Les **services** peuvent s'appeler entre eux ; ils factorisent la logique redondante entre use cases.
- Les **use cases** font de l'orchestration pure et peuvent manipuler les repositories directement.
- **DAO = SQL pur** (1 DAO = 1 table) ; **Repository = assemblage** (DAO + mapping vers le domaine).
- Erreurs : `Result<T, E>` pour le métier attendu, exceptions pour le technique imprévu.

### Modèle de données — authentification séparée du métier

L'identité **métier** et les données d'**authentification** sont volontairement scindées :

| Table | Responsabilité | Colonnes |
|---|---|---|
| `users` | Identité applicative (enrichie par le métier JDR à venir : pseudo, avatar…). | `id`, `created_at` |
| `credentials` | Authentification : e-mail + empreinte du mot de passe, reliés 1–1 à un `user`. | `id`, `user_id` (FK→users, UNIQUE), `email` (UNIQUE), `password_hash`, `created_at` |
| `refresh_tokens` | Sessions révocables rattachées à un `user`. | `id`, `user_id` (FK→users), `token_hash`, `expires_at`, `created_at` |

Côté domaine, cela donne deux entités : `User` (identité, sans e-mail ni mot de passe) et
`Credential` (e-mail + hash + `userId`, porte la vérification du mot de passe). Le métier
évolue ainsi sans toucher au modèle de sécurité, et inversement. Le contrat HTTP reste
inchangé : `register`/`login` renvoient toujours `{ userId, email }`.

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
npm run migrate:up

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
| `npm run migrate:up` | Applique les migrations en attente. |
| `npm run migrate:down` | **Échoue volontairement** : migrations *forward-only* (voir ci-dessous). |
| `npm run migrate:status` | Affiche l'état des migrations. |

> **Migrations forward-only** — Le projet n'applique pas de rollback automatique : annuler
> en supprimant la seule trace, sans défaire le DDL, laisserait la base incohérente.
> `migrate:down` lève donc une erreur explicite ; pour revenir en arrière, on écrit une
> nouvelle migration `Vxxx` correctrice.
