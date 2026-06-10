# Design — Route protégée `GET /me` + tests d'intégration DAO (Testcontainers)

**Date :** 2026-06-10
**Statut :** validé (brainstorming)
**Périmètre :** E-JDR-Backend (majoritaire) + E-JDR-Frontend (câblage `/me`)

## Contexte et objectifs

Deux manques identifiés lors de l'analyse du projet :

1. **Aucune route protégée n'existe** : seules les routes `/auth/*` sont exposées. L'intercepteur
   401 du frontend (refresh silencieux) n'est donc exercé par aucun cas réel.
2. **Les DAO sont exclus de la couverture** (`vitest.config.ts`) « en attendant des tests
   Testcontainers » : le SQL réel et le schéma ne sont validés par aucun test.

Objectifs :

- Poser le pattern complet de route protégée (middleware auth → use case → repository) que
  suivront les futurs domaines métier (campaigns…).
- Donner un cas réel à l'intercepteur 401 du frontend.
- Valider les DAO et les migrations contre un MySQL réel et jetable.

## Décisions de cadrage

| Décision | Choix | Justification |
|---|---|---|
| Forme de la route | `GET /me` complet (use case + lecture BDD) | Pose le pattern de bout en bout ; `/auth/me` est écarté car l'intercepteur 401 du frontend exclut les routes `/auth/` |
| Périmètre frontend | Câblé dans cette itération | Sans appel réel, le mécanisme 401 reste théorique |
| Intégration des tests DB | Script séparé `npm run test:db` + job CI dédié | `npm test` reste rapide et sans dépendance Docker |
| Librairie middleware | Maison (~30 lignes) | `JwtTokenProvider.verifyAccessToken()` existe déjà ; Passport serait une dépendance injustifiée |

## Volet 1 — Backend : route protégée `GET /me`

### Middleware d'authentification

`src/presentation/http/middlewares/authMiddleware.ts` :

- Factory `buildAuthMiddleware(tokenProvider: ITokenProvider)` (même style que
  `buildHttpLoggerMiddleware`).
- Lit le cookie `access_token`, le vérifie via `verifyAccessToken()`.
- Succès : attache `req.auth = { userId, email }` (extension de type Express dans `src/types/`,
  comme `req.requestId`).
- Cookie absent ou invalide : `401 { code: "UNAUTHENTICATED", message }`, la chaîne s'arrête.

### Use case `GetCurrentUser`

Dans `application/auth/` (conventions existantes) :

- `abstractions/usecases/IGetCurrentUserUseCase.ts`
- `commands/GetCurrentUserQuery.ts` — `{ userId: string }`
- `errors/UserNotFoundError.ts` — compte supprimé alors que le token est encore valide
- `usecases/GetCurrentUserUseCase.ts` — dépend de `IUserRepository` + `ICredentialRepository`,
  **lecture seule donc pas d'UnitOfWork** (règle lecture vs écriture du projet).
- Retour : `Result<{ userId, email, createdAt }, UserNotFoundError>`.

### Présentation

- `controllers/UserController.ts` — méthode `me` : lit `req.auth.userId`, appelle le use case.
- `routes/userRoutes.ts` — `buildUserRoutes(controller)`.
- `main.ts` — câblage :
  `app.use("/me", buildAuthMiddleware(tokenProvider), buildUserRoutes(userController));`
- Mapping HTTP :
  - Succès → `200 { userId, email, createdAt }`
  - `UserNotFoundError` → **401** (pas 404 : token valide pour un compte disparu = session
    invalide, le front doit déconnecter).

## Volet 2 — Backend : tests d'intégration DAO (Testcontainers)

- Dépendances dev : `testcontainers`, `@testcontainers/mysql`.
- `vitest.config.db.ts` : cible `tests/db/**/*.test.ts` uniquement, timeouts 60 s, pas de seuils
  de couverture. La config principale et ses exclusions DAO restent inchangées.
- Setup global (`tests/db/globalSetup.ts`) : démarre un conteneur `mysql:8`, exécute les
  **migrations réelles via Umzug** contre le conteneur (les migrations sont ainsi validées à
  chaque run), expose les paramètres de connexion aux tests.
- 3 suites : `UserDao`, `CredentialDao`, `RefreshTokenDao` — CRUD réel, contraintes (UNIQUE
  email, FK user_id), champs lockout, purge des tokens expirés. Tables nettoyées entre chaque
  test.
- Script : `"test:db": "vitest run --config vitest.config.db.ts"`.
- CI : job `db-tests` dans `ci.yml` (Docker disponible sur `ubuntu-latest`), parallèle à
  `build-and-test`.

## Volet 3 — Frontend Kotlin : câblage `GET /me`

- Port : `AuthRepository.me(): Result<User, AuthError>`.
- Impl : `AuthHttpRepository.me()` — `GET /me`, réutilise `AuthHttpMapper` (401 final →
  `AuthError.SessionExpired`).
- `GetCurrentUserUseCase` (interface + impl) dans `application/auth/`, enregistré dans Koin.
- `UserPage` (Home) : au chargement, appelle le use case et affiche l'email renvoyé par le
  serveur. `SessionExpired` → retour à l'écran Login.
- L'intercepteur 401 existant exclut `/auth/` ; `GET /me` n'en fait pas partie : le refresh
  silencieux s'applique **sans aucune retouche**. Scénario réel couvert : access token expiré
  → 401 sur `/me` → refresh silencieux → rejeu → 200.
- Note : le DTO de réponse frontend lit `userId`/`email` ; `createdAt` est ignoré (vérifier que
  le client JSON est configuré avec `ignoreUnknownKeys`, sinon l'ajouter au DTO).

## Gestion d'erreurs (vue bout en bout)

| Scénario | Backend | Frontend |
|---|---|---|
| Cookie absent/invalide | 401 (middleware) | Intercepteur tente un refresh ; échec → `SessionExpired` → Login |
| Access expiré, refresh valide | 401 puis 200 au rejeu | Transparent pour l'utilisateur |
| Compte supprimé | 401 (use case) | `SessionExpired` → Login |

## Tests

**Backend (unitaires + intégration HTTP, config principale) :**

- `GetCurrentUserUseCase` avec fakes (succès, user introuvable, credential introuvable).
- Middleware auth (cookie valide / absent / invalide).
- Intégration supertest : `200` cookie valide, `401` sans cookie, `401` token invalide,
  `401` user supprimé.

**Backend (Testcontainers, config dédiée) :** 3 suites DAO décrites au volet 2.

**Frontend :** `GetCurrentUserUseCaseTest` (MockK) + test de `AuthHttpRepository.me()`
(moteur HTTP mocké), conformes aux tests existants.

## Hors périmètre

- Toute nouvelle entité métier (campaigns…) — cette route pose seulement le pattern.
- WebSocket, rôles/permissions, rate-limiting.
- Migration de l'existant : aucune route actuelle ne change de comportement.
