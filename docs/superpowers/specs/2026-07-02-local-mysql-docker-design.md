# Design — MySQL local via Docker pour le backend E-JDR

**Date** : 2026-07-02
**Branche** : `feat/local-mysql-docker` (depuis `develop`)
**Statut** : validé, prêt pour plan d'implémentation

## Objectif

Quand on lance le backend en local, il doit se connecter à un **MySQL conteneurisé Docker**
(persistant) au lieu d'exiger un serveur MySQL installé « en dur » sur la machine.
L'outillage est **commité pour toute l'équipe** : n'importe qui pourra obtenir un MySQL local
identique avec `docker compose up -d`.

## Contexte existant (ne change pas)

- Le back lit sa config DB depuis `.env` via dotenv (`src/config/env.ts`) :
  `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
  **Le code applicatif n'est donc pas modifié** — on ne fait qu'ajouter l'outillage qui
  *fournit* le MySQL attendu.
- Le `.env` actuel du développeur : `DB_HOST=localhost`, `DB_PORT=3306`, `DB_USER=root`,
  `DB_PASSWORD=root`, `DB_NAME=e_jdr`. Le docker-compose est aligné sur ces valeurs pour que
  **le `.env` reste inchangé**.
- `test:db` utilise déjà **testcontainers** (`@testcontainers/mysql`) pour un MySQL éphémère
  dédié aux tests d'intégration. **On n'y touche pas** — c'est un flux indépendant.
- Aucun `docker-compose` n'existait dans le repo.
- La prod/dev (Vertex) tourne sous MySQL 8 → le conteneur local s'aligne sur `mysql:8.0`.

## Décisions de conception

1. **docker-compose séparé** (pas d'auto-démarrage dans `npm run dev`) : le cycle de vie de la
   base est découplé de celui de l'app. On démarre le conteneur une fois, il persiste.
2. **Migrations Drizzle** pour le schéma (`npm run db:migrate`, déjà existant). **Pas de seed**
   de données de démo : base vide au départ, on crée comptes/campagnes via l'app.
3. **Commité pour l'équipe** : outillage de dev standard, pas de secret sensible (mot de passe
   local trivial `root`).
4. **Port 3306 standard** : un MySQL natif (`mysqld`) tourne déjà sur la machine du dev et
   occupe le 3306. On l'arrête et on passe son démarrage en Manual pour que Docker prenne le
   3306. Cela garde `DB_PORT=3306` cohérent avec le reste de l'équipe. Cette opération est
   **locale à la machine (non commitée)** et faite après vérification + accord explicite.

## Composants

### `docker-compose.yml` (nouveau, racine backend — commité)

Un unique service `mysql` :
- Image `mysql:8.0` (aligne sur la prod Vertex).
- Ports `3306:3306`.
- Env : `MYSQL_ROOT_PASSWORD=root`, `MYSQL_DATABASE=e_jdr` (crée la base vide au 1er boot ;
  aligné sur le `.env` → rien à changer côté dev).
- **Volume nommé** `ejdr-mysql-data` monté sur `/var/lib/mysql` → les données survivent aux
  `docker compose down` et aux redémarrages. (Volume nommé géré par Docker, pas un dossier du
  repo → aucune donnée ne risque d'être commitée.)
- **Healthcheck** via `mysqladmin ping` → savoir quand MySQL accepte réellement les connexions
  (init ~10-20 s au 1er lancement).
- `restart: unless-stopped`.

### `package.json` (+2 scripts — commité)

- `"db:up": "docker compose up -d"` — démarre le MySQL Docker.
- `"db:down": "docker compose down"` — l'arrête (données conservées via volume nommé ;
  `docker compose down -v` pour repartir de zéro).

Aucun script existant n'est modifié. `dev` n'orchestre PAS le conteneur (découplage voulu).

### `README.md` (mis à jour — commité)

Section « Démarrage » : le workflow BDD locale devient
```bash
docker compose up -d     # ou npm run db:up   (prérequis : Docker Desktop)
npm run db:migrate       # applique les migrations → crée les tables
npm run dev
```
Note : `docker compose down -v` réinitialise la base.

### `.env.example` (commentaire — commité)

Valeurs déjà correctes (`localhost` / `3306` / `e_jdr`). On ajoute un commentaire précisant
qu'elles correspondent au `docker-compose.yml` fourni.

### MySQL natif de la machine (local, NON commité)

- Identifier précisément le `mysqld` occupant le 3306 (service Windows ou processus lancé main).
- Si service : `Stop-Service` + passage du démarrage en **Manual** (réversible, pas de
  désinstallation). Montrer au dev avant d'agir.
- Si processus manuel : montrer ce que c'est, fournir la commande d'arrêt, ne rien tuer à
  l'aveugle.

## Flux développeur cible

Premier clone :
```bash
docker compose up -d      # MySQL persistant, attendre le healthcheck (healthy)
npm run db:migrate        # crée les tables
npm run dev               # back sur localhost:3000
```
Runs suivants : conteneur + données déjà là → `npm run dev`.

## Récapitulatif des fichiers

| Fichier | Action | Commité |
|---|---|---|
| `docker-compose.yml` | créé (mysql:8, 3306, volume `ejdr-mysql-data`, healthcheck) | ✅ |
| `package.json` | +2 scripts `db:up` / `db:down` | ✅ |
| `README.md` | section Démarrage → workflow Docker | ✅ |
| `.env.example` | commentaire (valeurs déjà bonnes) | ✅ |
| MySQL natif (mysqld) | arrêté + démarrage Manual (après vérif + accord) | ❌ local |
| `.env` (du dev) | inchangé | ❌ (gitignore) |

## Hors périmètre (YAGNI)

- Pas de seed de démo.
- Pas d'auto-démarrage du conteneur dans `dev`.
- Pas de modification de `test:db` / testcontainers.
- Pas de désinstallation du MySQL natif (arrêt/désactivation réversible seulement).
- Pas d'adminer/phpMyAdmin dans le compose (non demandé).

## Vérification

- `docker compose up -d` → conteneur `healthy`.
- `npm run db:migrate` → 11 migrations appliquées sans erreur.
- `npm run dev` → back démarre, connexion DB OK, une route lisant la base répond.
- `docker compose down` puis `up` → données toujours présentes (persistance volume).
