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
