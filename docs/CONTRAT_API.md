# Contrat API HTTP — E-JDR Backend

Document de référence backend ↔ frontend pour les endpoints existants.
**Base URL** : `/` (configurable via env).
**Transport des jetons** : cookies httpOnly uniquement — pas de header `Authorization`.

---

## Endpoints d'authentification

### POST /auth/register

Crée un compte et connecte l'utilisateur directement.

**Corps de la requête**

```json
{ "email": "alice@example.com", "password": "Passw0rd!" }
```

**Réponse 201 Created**

```json
{ "userId": "uuid-v4", "email": "alice@example.com" }
```

Cookies posés (httpOnly, sameSite=strict, secure en production) :

| Cookie | Durée |
|---|---|
| `access_token` | 15 min |
| `refresh_token` | 7 jours |

**Codes d'erreur**

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `EMAIL_ALREADY_USED` | 409 | Un compte existe déjà pour cette adresse e-mail |
| `INVALID_EMAIL` | 400 | Format d'e-mail invalide (validation domaine) |
| `WEAK_PASSWORD` | 400 | Mot de passe trop faible (longueur, complexité) |

---

### POST /auth/login

Authentifie un utilisateur existant.

**Corps de la requête**

```json
{ "email": "alice@example.com", "password": "Passw0rd!" }
```

**Réponse 200 OK**

```json
{ "userId": "uuid-v4", "email": "alice@example.com" }
```

Cookies posés : identiques à `/auth/register` (voir ci-dessus).

**Codes d'erreur**

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | E-mail inconnu ou mot de passe incorrect (message identique dans les deux cas — protection contre l'énumération) |
| `ACCOUNT_LOCKED` | 429 | Compte verrouillé suite à trop de tentatives (5 échecs → 15 min). Le message inclut la date de déverrouillage ISO 8601 |

---

### POST /auth/refresh

Régénère l'access token et fait tourner le refresh token (rotation).

**Corps de la requête** : vide (le cookie `refresh_token` est lu automatiquement).

**Réponse 200 OK**

```json
{ "message": "Token rafraîchi." }
```

Cookies mis à jour : nouveau `access_token` (15 min) + nouveau `refresh_token` (7 j, l'ancien
est révoqué en BDD).

**Codes d'erreur**

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `INVALID_REFRESH_TOKEN` | 401 | Cookie absent, expiré, mal signé, ou token révoqué en BDD |

---

### POST /auth/logout

Révoque le refresh token en BDD et efface les cookies.

**Corps de la requête** : vide (le cookie `refresh_token` est lu).

**Réponse 200 OK**

```json
{ "message": "Déconnexion réussie." }
```

Cookies effacés : `access_token` et `refresh_token`.

**Codes d'erreur** : aucun code métier — la déconnexion réussit même si le token est déjà
révoqué (idempotent côté client).

---

### GET /me

Retourne le profil de l'utilisateur authentifié. Endpoint **protégé** : requiert un cookie
`access_token` valide.

**Corps de la requête** : aucun.

**Réponse 200 OK**

```json
{ "userId": "uuid-v4", "email": "alice@example.com", "createdAt": "2026-01-15T10:30:00.000Z" }
```

**Codes d'erreur**

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Cookie `access_token` absent ou JWT invalide/expiré |
| `USER_NOT_FOUND` | 401 | Token valide mais le compte a été supprimé depuis l'émission |

---

## Endpoints campagnes

Toutes les routes campagne sont **protégées** : elles requièrent un cookie `access_token` valide.
Le **maître du jeu** (`gameMasterId`) est toujours déduit de la session — jamais transmis dans le corps.

### POST /campaigns

Crée une campagne dont l'utilisateur authentifié est le maître du jeu. Un même utilisateur peut
posséder plusieurs campagnes.

**Corps de la requête**

```json
{ "name": "La Quête du Dragon" }
```

**Réponse 201 Created**

```json
{ "id": "uuid-v4", "name": "La Quête du Dragon", "createdAt": "2026-06-13T10:30:00.000Z" }
```

**Codes d'erreur**

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `INVALID_CAMPAIGN_NAME` | 400 | Nom absent, vide après normalisation, ou de plus de 120 caractères |
| `UNAUTHENTICATED` | 401 | Cookie `access_token` absent ou JWT invalide/expiré |

---

### GET /campaigns

Liste les campagnes dont l'utilisateur authentifié est le maître du jeu (des plus récentes aux
plus anciennes).

**Corps de la requête** : aucun.

**Réponse 200 OK**

```json
{
  "campaigns": [
    { "id": "uuid-v4", "name": "La Quête du Dragon", "createdAt": "2026-06-13T10:30:00.000Z" }
  ]
}
```

La liste est vide (`{ "campaigns": [] }`) si l'utilisateur n'a aucune campagne.

**Codes d'erreur**

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Cookie `access_token` absent ou JWT invalide/expiré |

---

### DELETE /campaigns/:id

Supprime une campagne. **Seul le maître du jeu propriétaire** peut la supprimer.

**Corps de la requête** : aucun (`:id` est l'identifiant de la campagne dans l'URL).

**Réponse 204 No Content** : suppression réussie, aucun corps.

**Codes d'erreur**

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `CAMPAIGN_NOT_FOUND` | 404 | Aucune campagne ne correspond à cet identifiant |
| `CAMPAIGN_ACCESS_DENIED` | 403 | L'utilisateur n'est pas le maître du jeu de cette campagne |
| `UNAUTHENTICATED` | 401 | Cookie `access_token` absent ou JWT invalide/expiré |

---

## Endpoints sessions

Une **session** est une rencontre de jeu rattachée à une campagne (relation 1‑N : une campagne
a plusieurs sessions, une session appartient à une campagne). Toutes les routes sont **protégées**
(cookie `access_token`) et **réservées au maître du jeu** de la campagne parente : l'identité du
demandeur est déduite de la session, jamais transmise dans le corps. Le champ `date` est au format
`YYYY-MM-DD` ; `createdAt` est en ISO 8601 complet.

### POST /campaigns/:campaignId/sessions

Crée une session dans la campagne. **Réservé au MJ de la campagne.**

**Corps** : `{ "title": "Le réveil du dragon", "date": "2026-06-20" }`

**Réponse 201 Created** : `{ "id", "campaignId", "title", "date", "createdAt" }`

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `INVALID_SESSION_TITLE` | 400 | Titre absent, vide après normalisation, ou > 120 caractères |
| `INVALID_SESSION_DATE` | 400 | Date absente ou hors format `YYYY-MM-DD` (ou date inexistante) |
| `CAMPAIGN_NOT_FOUND` | 404 | Campagne inconnue |
| `CAMPAIGN_ACCESS_DENIED` | 403 | Le demandeur n'est pas le MJ de la campagne |
| `UNAUTHENTICATED` | 401 | Non authentifié |

### GET /campaigns/:campaignId/sessions

Liste les sessions de la campagne (de la plus récente à la plus ancienne, par `date`).
**Réservé au MJ de la campagne.**

**Réponse 200 OK** :
`{ "sessions": [ { "id", "campaignId", "title", "date", "createdAt" } ] }` — liste vide si aucune.

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `CAMPAIGN_NOT_FOUND` | 404 | Campagne inconnue |
| `CAMPAIGN_ACCESS_DENIED` | 403 | Le demandeur n'est pas le MJ de la campagne |
| `UNAUTHENTICATED` | 401 | Non authentifié |

### GET /sessions/:id

Détail d'une session. **Réservé au MJ de la campagne parente.**

**Réponse 200 OK** : `{ "id", "campaignId", "title", "date", "createdAt" }`

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `SESSION_NOT_FOUND` | 404 | Session inconnue |
| `CAMPAIGN_ACCESS_DENIED` | 403 | Le demandeur n'est pas le MJ de la campagne parente |
| `UNAUTHENTICATED` | 401 | Non authentifié |

### PUT /sessions/:id

Met à jour le titre et la date d'une session. **Réservé au MJ de la campagne parente.**

**Corps** : `{ "title": "Nouveau titre", "date": "2026-07-01" }`

**Réponse 200 OK** : la session complète (même forme que `GET /sessions/:id`).

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `INVALID_SESSION_TITLE` | 400 | Titre absent, vide, ou > 120 caractères |
| `INVALID_SESSION_DATE` | 400 | Date hors format `YYYY-MM-DD` (ou inexistante) |
| `SESSION_NOT_FOUND` | 404 | Session inconnue |
| `CAMPAIGN_ACCESS_DENIED` | 403 | Le demandeur n'est pas le MJ de la campagne parente |
| `UNAUTHENTICATED` | 401 | Non authentifié |

### DELETE /sessions/:id

Supprime une session. **Réservé au MJ de la campagne parente.** **Réponse 204 No Content**.

| Code applicatif | Statut HTTP | Sens |
|---|---|---|
| `SESSION_NOT_FOUND` | 404 | Session inconnue |
| `CAMPAIGN_ACCESS_DENIED` | 403 | Le demandeur n'est pas le MJ de la campagne parente |
| `UNAUTHENTICATED` | 401 | Non authentifié |

---

## Endpoints fiches de personnage

Toutes les routes sont **protégées** (cookie `access_token`). Le propriétaire (`ownerId`) est
toujours déduit de la session.

### POST /character-sheets

Crée une fiche appartenant à l'utilisateur authentifié.

**Corps** : `{ "name": "Aragorn" }` — **Réponse 201** : `{ "id", "ownerId", "name", "createdAt" }`

| Code | HTTP | Sens |
|---|---|---|
| `INVALID_CHARACTER_SHEET_NAME` | 400 | Nom absent, vide, ou > 120 caractères |
| `UNAUTHENTICATED` | 401 | Non authentifié |

### GET /character-sheets

Liste les fiches de l'utilisateur authentifié. Projection **légère** (nom seul, pour les tuiles).
**Réponse 200** : `{ "characterSheets": [ { "id", "ownerId", "name", "createdAt" } ] }`.

### GET /character-sheets/:id

Détail **complet** d'une fiche (seul le propriétaire). **Réponse 200** : tous les champs —
`{ "id", "ownerId", "name", "createdAt", "formation", "niveau", "peuple", "sexe",
"tailleEtPoids", "age", "apparence", "dexterite", "intelligence", "perception", "social",
"vigueur", "pointsDeVie", "pointsDeMagie", "protection", "purse", "competences", "armes",
"armures", "equipement", "sortsEtMiracles", "notes" }`. Précisions de types :
- `niveau`, `age` : entiers (`number`) ou `null`.
- `sexe` : `"M"` | `"F"` | `"NB"` | `null`.
- `purse` : `{ "gold", "silver", "copper" }` (entiers bruts) ou `null` si aucune bourse.
- les autres champs détaillés : texte ou `null`.

Champs détaillés `null` si non renseignés. Erreurs : `CHARACTER_SHEET_NOT_FOUND` (404),
`CHARACTER_SHEET_ACCESS_DENIED` (403), `UNAUTHENTICATED` (401).

### GET /character-sheets/:id/campaigns

Liste les campagnes auxquelles la fiche est rattachée, enrichies du pseudo du MJ (**seul le
propriétaire de la fiche**). **Réponse 200** :
`{ "campaigns": [ { "campaignId", "campaignName", "gameMasterPseudo" } ] }` — liste vide si la
fiche n'est rattachée à aucune campagne, des plus récemment rattachées aux plus anciennes. Erreurs :
`CHARACTER_SHEET_NOT_FOUND` (404), `CHARACTER_SHEET_ACCESS_DENIED` (403), `UNAUTHENTICATED` (401).

### GET /character-sheets/:id/export-pdf

Exporte la fiche au format PDF (**seul le propriétaire**). **Réponse 200** : le PDF en binaire,
`Content-Type: application/pdf` et `Content-Disposition: attachment; filename="fiche-{slug}.pdf"`
(le `slug` est dérivé du nom de la fiche). Erreurs (réponse JSON `{ code, message }`) :
`CHARACTER_SHEET_NOT_FOUND` (404), `CHARACTER_SHEET_ACCESS_DENIED` (403), `UNAUTHENTICATED` (401).

### PUT /character-sheets/:id

Met à jour une fiche (seul le propriétaire). Saisie **souple** : seul `name` est requis (revalidé,
max 120) ; les champs détaillés sont optionnels (texte borné, nombres entiers ≥ 0, normalisés
côté serveur). **Corps** : `{ "name", + champs détaillés optionnels }` — dont `sexe` ∈ {M,F,NB},
`niveau`/`age` entiers, et `purse: { gold, silver, copper }` (entiers ≥ 0). **Réponse 200** : la
fiche complète (même forme que `GET /character-sheets/:id`). Erreurs : `INVALID_CHARACTER_SHEET_NAME`
(400), `INVALID_SEX` (400), `INVALID_PURSE` (400), `CHARACTER_SHEET_NOT_FOUND` (404),
`CHARACTER_SHEET_ACCESS_DENIED` (403), `UNAUTHENTICATED` (401).

### DELETE /character-sheets/:id

Supprime une fiche (seul le propriétaire). **Réponse 204**. Erreurs : `CHARACTER_SHEET_NOT_FOUND` (404), `CHARACTER_SHEET_ACCESS_DENIED` (403), `UNAUTHENTICATED` (401).

---

## Endpoints liaison campagne ↔ fiches

Routes protégées sous `/campaigns/:campaignId/characters`. Modèle N-N : une fiche peut être
rattachée à plusieurs campagnes.

### POST /campaigns/:campaignId/characters

Rattache une fiche à la campagne. **Réservé au MJ de la campagne** : il rattache la fiche d'un
autre joueur (le `actorUserId` vient de la session, jamais du corps).

**Corps** : `{ "characterSheetId": "uuid" }` — **Réponse 201** (aucun corps).

| Code | HTTP | Sens |
|---|---|---|
| `CAMPAIGN_NOT_FOUND` | 404 | Campagne inconnue |
| `CHARACTER_SHEET_NOT_FOUND` | 404 | Fiche inconnue |
| `CHARACTER_SHEET_ACCESS_DENIED` | 403 | Le demandeur n'est pas le MJ de la campagne |
| `GM_CANNOT_JOIN_OWN_CAMPAIGN` | 409 | Le MJ ne peut pas rattacher une de ses fiches à sa propre campagne |
| `SHEET_ALREADY_IN_CAMPAIGN` | 409 | Fiche déjà rattachée à cette campagne |
| `UNAUTHENTICATED` | 401 | Non authentifié |

### GET /campaigns/:campaignId/characters

Liste les fiches rattachées à la campagne. **Réponse 200** : `{ "characters": [ { "id", "ownerId", "name", "createdAt" } ] }`. Erreur `CAMPAIGN_NOT_FOUND` (404).

### GET /campaigns/:campaignId/linkable-characters

**Réservé au MJ de la campagne.** Liste les fiches **rattachables** : toutes celles dont le
propriétaire n'est pas le MJ, en excluant les fiches déjà rattachées à la campagne. **Réponse 200** :
`{ "characters": [ { "id", "ownerId", "name", "createdAt" } ] }`. Erreurs : `CAMPAIGN_NOT_FOUND` (404),
`CHARACTER_SHEET_ACCESS_DENIED` (403, le demandeur n'est pas le MJ), `UNAUTHENTICATED` (401).

### DELETE /campaigns/:campaignId/characters/:characterSheetId

Détache une fiche. **Réservé au MJ de la campagne.** **Réponse 204** (idempotent). Erreurs : `CAMPAIGN_NOT_FOUND`/`CHARACTER_SHEET_NOT_FOUND` (404), `CHARACTER_SHEET_ACCESS_DENIED` (403, le demandeur n'est pas le MJ).

---

## Décisions de contrat

### USER_NOT_FOUND renvoyé en 401, pas 404

Un jeton valide pour un compte qui n'existe plus signifie que la **session est invalide**,
pas que la ressource est absente. Du point de vue du client, le comportement attendu est
identique à un token expiré : déconnecter l'utilisateur et le rediriger vers le login.
Un 404 induirait en erreur (la ressource "moi" n'est pas simplement introuvable — la session
entière est caduque). Le frontend mappe ce code vers `SessionExpired`.

### ACCOUNT_LOCKED renvoyé en 429 (pas 401)

Le 429 (Too Many Requests) traduit précisément la cause : le compte est verrouillé à la suite
d'un comportement répété, pas parce que les credentials sont incorrects. Le frontend dispose
d'une variante `AuthError.AccountLocked` distincte de `AuthError.InvalidCredentials`, et peut
ainsi afficher un message spécifique ("Compte verrouillé jusqu'à HH:MM") plutôt qu'un message
générique.

### Le code applicatif prime sur le statut HTTP côté client

Plusieurs codes applicatifs distincts peuvent partager un même statut HTTP 401. Le frontend
doit **toujours** lire le corps de la réponse pour discriminer :

| Statut | Code applicatif | Interprétation client |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | Mauvais identifiants — afficher le message d'erreur de champ |
| 401 | `INVALID_REFRESH_TOKEN` | Session expirée — forcer la reconnexion |
| 401 | `UNAUTHENTICATED` | Token absent/invalide — rediriger vers login |
| 401 | `USER_NOT_FOUND` | Session invalide (compte supprimé) — déconnecter |

Ne jamais router uniquement sur le statut HTTP : un 401 brut sans code est `INVALID_CREDENTIALS`
par défaut, mais `INVALID_REFRESH_TOKEN` implique une gestion de session différente.

### Cookies httpOnly, sameSite, secure

- `httpOnly` : inaccessibles en JavaScript — protection XSS.
- `sameSite=strict` : non transmis en cross-site — protection CSRF.
- `secure` : HTTPS uniquement en production (`NODE_ENV=production`).
- L'access token est court-vécu (15 min) : limite la fenêtre d'abus si un JWT fuite.
- Le refresh token est stocké **haché** en BDD et est **révocable** (logout, rotation) :
  contrairement au JWT access token, une compromission peut être annulée.

---

## Note : à maintenir

Ce document doit être mis à jour à chaque :
- Nouvel endpoint ajouté à la présentation.
- Nouveau code d'erreur applicatif (`AppError`) introduit dans n'importe quelle feature.
- Modification du schéma de réponse (champs ajoutés/supprimés) ou des cookies.

A terme, ce document vocation à être **remplacé** par une spécification OpenAPI (Swagger)
générée ou co-localisée avec le code, permettant de générer automatiquement les types DTO
côté frontend et de valider les réponses en test d'intégration. Tant que ce passage n'est pas
fait, ce fichier Markdown est la source de vérité contractuelle.
