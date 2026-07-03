# MySQL local via Docker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fournir un MySQL conteneurisé Docker persistant pour l'exécution locale du backend, sans modifier le code applicatif.

**Architecture:** Un `docker-compose.yml` (service `mysql:8.0`, volume nommé persistant, healthcheck) fournit la base que le back lit déjà via `.env`. Deux scripts npm de confort enrobent `docker compose`. La doc README est mise à jour. Le MySQL natif de la machine du dev est arrêté/désactivé localement (non commité) pour libérer le port 3306.

**Tech Stack:** Docker Compose, MySQL 8.0, npm scripts, Drizzle (migrations existantes).

## Global Constraints

- Image MySQL : `mysql:8.0` (aligne sur la prod Vertex).
- Port hôte : `3306` (standard, cohérent avec le reste de l'équipe).
- Credentials alignés sur le `.env` du dev : `MYSQL_ROOT_PASSWORD=root`, base `e_jdr`.
- Volume **nommé** `ejdr-mysql-data` (géré par Docker, jamais un dossier du repo).
- **Ne pas** modifier le code applicatif (`src/**`), ni `test:db`/testcontainers, ni le `.env` du dev.
- Toutes les commandes Docker via `docker compose` (v2, sous-commande — pas `docker-compose` binaire).
- Sur cette machine Windows, le binaire docker peut ne pas être dans le PATH d'un shell déjà ouvert : chemin complet `"/c/Program Files/Docker/Docker/resources/bin/docker.exe"` en secours, ou `export PATH="$PATH:/c/Program Files/Docker/Docker/resources/bin"` dans un shell bash.
- Piège bash sous Windows : le credential helper `docker-credential-desktop` n'est pas dans le PATH du shell bash → `docker pull` peut échouer avec `error getting credentials`. Ajouter le bin Docker au PATH (ligne ci-dessus) résout le souci ; le pull d'une image publique ne nécessite aucun login.

---

### Task 1 : docker-compose.yml (service MySQL persistant)

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: rien.
- Produces: un service Docker `mysql` exposant `localhost:3306`, base `e_jdr`, user `root`/mot de passe `root`. C'est le contrat que le `.env` du back consomme (`DB_HOST=localhost DB_PORT=3306 DB_USER=root DB_PASSWORD=root DB_NAME=e_jdr`).

- [ ] **Step 1 : Créer le fichier `docker-compose.yml`**

```yaml
# MySQL local pour le développement du backend E-JDR.
# Fournit la base que le back lit via .env (DB_HOST=localhost, DB_PORT=3306,
# DB_USER=root, DB_PASSWORD=root, DB_NAME=e_jdr).
# Usage : `docker compose up -d` (ou `npm run db:up`), puis `npm run db:migrate`.
# Ne concerne QUE le dev local ; les tests (test:db) utilisent testcontainers.
services:
  mysql:
    image: mysql:8.0
    container_name: ejdr-mysql-local
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: e_jdr
    volumes:
      - ejdr-mysql-data:/var/lib/mysql
    healthcheck:
      # Vérifie que MySQL accepte réellement les connexions (init ~10-20 s au 1er boot).
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot"]
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 30s

volumes:
  ejdr-mysql-data:
```

- [ ] **Step 2 : Valider la syntaxe du compose**

Run: `docker compose config`
Expected: le YAML résolu s'affiche sans erreur (service `mysql`, volume `ejdr-mysql-data`). Aucun message `services.mysql ... is invalid`.

- [ ] **Step 3 : Démarrer le conteneur**

Run: `docker compose up -d`
Expected: `Container ejdr-mysql-local  Started` (l'image `mysql:8.0` se télécharge si absente).

- [ ] **Step 4 : Attendre l'état `healthy` et vérifier**

Run: `docker compose ps`
Expected: la colonne STATUS affiche `Up ... (healthy)` pour `ejdr-mysql-local`. (Réexécuter après ~20-30 s si encore `health: starting`.)

- [ ] **Step 5 : Vérifier que la base `e_jdr` existe**

Run: `docker compose exec mysql mysql -uroot -proot -e "SHOW DATABASES;"`
Expected: la liste contient `e_jdr` (créée par `MYSQL_DATABASE`).

- [ ] **Step 6 : Commit**

```bash
git add docker-compose.yml
git commit -m "feat: docker-compose MySQL local pour le dev du back"
```

---

### Task 2 : Scripts npm db:up / db:down

**Files:**
- Modify: `package.json` (bloc `scripts`)

**Interfaces:**
- Consumes: le service `mysql` du `docker-compose.yml` (Task 1).
- Produces: `npm run db:up` (démarre le MySQL Docker) et `npm run db:down` (l'arrête, données conservées).

- [ ] **Step 1 : Ajouter les deux scripts dans `package.json`**

Dans le bloc `"scripts"`, après la ligne `"db:reset": ...`, ajouter :

```json
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
```

(Veiller à la virgule de fin sur la ligne précédente ; ces deux lignes ne sont pas les dernières du bloc si `prepare`/`release` suivent — respecter le JSON valide.)

- [ ] **Step 2 : Vérifier que le JSON reste valide**

Run: `node -e "require('./package.json'); console.log('package.json OK')"`
Expected: `package.json OK` (aucune SyntaxError).

- [ ] **Step 3 : Vérifier que npm voit les scripts**

Run: `npm run db:up`
Expected: le conteneur démarre (ou `Container ejdr-mysql-local  Running` s'il tourne déjà). Aucune erreur `Missing script`.

- [ ] **Step 4 : Vérifier db:down puis relancer**

Run: `npm run db:down && npm run db:up`
Expected: `down` retire le conteneur (le volume `ejdr-mysql-data` est CONSERVÉ — non listé dans les « Removing volume »), `up` le recrée.

- [ ] **Step 5 : Commit**

```bash
git add package.json
git commit -m "feat: scripts npm db:up/db:down pour le MySQL local"
```

---

### Task 3 : Migrations + smoke test de l'exécution locale

**Files:**
- (aucun fichier modifié — validation du flux de bout en bout)

**Interfaces:**
- Consumes: conteneur MySQL `healthy` (Task 1), scripts npm (Task 2), `.env` local du dev (déjà présent : `DB_HOST=localhost DB_PORT=3306 DB_USER=root DB_PASSWORD=root DB_NAME=e_jdr`).
- Produces: preuve que `npm run dev` se connecte au MySQL Docker et que les tables existent. Aucun artefact commité.

> **Prérequis machine** : le port 3306 doit être libre côté hôte. Sur la machine du dev, un `mysqld` natif l'occupe — il est neutralisé en Task 4. Si `docker compose up` échoue avec `port is already allocated`, exécuter Task 4 d'abord.

- [ ] **Step 1 : S'assurer que le conteneur tourne et est `healthy`**

Run: `npm run db:up && docker compose ps`
Expected: `ejdr-mysql-local` en `Up ... (healthy)`.

- [ ] **Step 2 : Appliquer les migrations**

Run: `npm run db:migrate`
Expected: drizzle-kit applique les migrations en attente sans erreur (aucun `ER_BAD_DB_ERROR`, aucun `ECONNREFUSED`). Sortie se terminant sans exception.

- [ ] **Step 3 : Vérifier que les tables ont été créées**

Run: `docker compose exec mysql mysql -uroot -proot e_jdr -e "SHOW TABLES;"`
Expected: une liste non vide de tables (users, campaigns, character_sheets, etc. selon le schéma Drizzle).

- [ ] **Step 4 : Démarrer le back et vérifier la connexion DB**

Run: `npm run dev`
Expected: le serveur démarre et écoute sur le port 3000 (log Pino d'écoute), sans erreur de connexion MySQL. Arrêter avec Ctrl+C après confirmation.

- [ ] **Step 5 : Vérifier la persistance des données**

Run:
```bash
docker compose exec mysql mysql -uroot -proot e_jdr -e "CREATE TABLE _persist_check (id INT); INSERT INTO _persist_check VALUES (42);"
npm run db:down && npm run db:up
docker compose exec mysql mysql -uroot -proot e_jdr -e "SELECT * FROM _persist_check;"
```
Expected: après le cycle down/up, la requête renvoie la ligne `42` → le volume persiste. Nettoyer ensuite : `docker compose exec mysql mysql -uroot -proot e_jdr -e "DROP TABLE _persist_check;"`.

- [ ] **Step 6 : (pas de commit — validation runtime uniquement)**

Aucun fichier modifié. Consigner le résultat du smoke test dans le compte-rendu de tâche.

---

### Task 4 : Neutraliser le MySQL natif (local, NON commité)

**Files:**
- (aucun fichier du repo — opérations système sur la machine du dev)

**Interfaces:**
- Consumes: rien.
- Produces: le port 3306 libéré pour Docker, de façon réversible.

> ⚠️ Cette tâche modifie l'état système de la machine, pas le repo. **Montrer chaque résultat avant d'agir.** Ne rien désinstaller. Ne rien tuer à l'aveugle.

- [ ] **Step 1 : Identifier ce qui occupe le port 3306**

Run (PowerShell):
```powershell
$c = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
$c | ForEach-Object { Get-Process -Id $_.OwningProcess | Select-Object Id, ProcessName, Path }
Get-CimInstance Win32_Service | Where-Object { $_.PathName -match 'mysqld' } | Select-Object Name, DisplayName, State, StartMode, PathName
```
Expected: identifie le `mysqld` (PID) et, s'il existe, le **service Windows** associé (nom, StartMode). Noter si c'est un service ou un processus lancé à la main.

- [ ] **Step 2a : Cas SERVICE — arrêter et passer en démarrage Manual**

Si un service MySQL est trouvé (ex. `MySQL80`), montrer son nom au dev, obtenir son accord, puis (PowerShell **Administrateur**) :
```powershell
Stop-Service -Name '<NomDuService>' -Force
Set-Service -Name '<NomDuService>' -StartupType Manual
Get-Service -Name '<NomDuService>' | Select-Object Name, Status, StartType
```
Expected: `Status = Stopped`, `StartType = Manual` (ne redémarrera pas au boot ; réversible via `Set-Service -StartupType Automatic`).

- [ ] **Step 2b : Cas PROCESSUS MANUEL — arrêter le processus**

Si AUCUN service (mysqld lancé à la main), montrer le chemin/PID au dev, obtenir son accord, puis :
```powershell
Stop-Process -Id <PID> -Force
```
Expected: le processus se termine. Prévenir le dev qu'il peut se relancer manuellement au prochain démarrage de l'outil qui l'avait lancé.

- [ ] **Step 3 : Vérifier que le port 3306 est libre**

Run (PowerShell):
```powershell
if (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue) { "3306 ENCORE OCCUPE" } else { "3306 LIBRE" }
```
Expected: `3306 LIBRE`.

- [ ] **Step 4 : Redémarrer le conteneur sur le 3306 désormais libre**

Run: `npm run db:down; npm run db:up; docker compose ps`
Expected: `ejdr-mysql-local` démarre sans `port is already allocated` et passe `healthy`. (Si Docker tournait déjà sur 3306 sans conflit, cette étape confirme simplement l'état sain.)

- [ ] **Step 5 : (pas de commit — opération locale machine)**

---

### Task 5 : Documentation (README + .env.example)

**Files:**
- Modify: `README.md` (section « Démarrage »)
- Modify: `.env.example` (commentaire section BDD)

**Interfaces:**
- Consumes: le workflow validé (Tasks 1-3).
- Produces: doc à jour décrivant le démarrage via Docker.

- [ ] **Step 1 : Mettre à jour la section « Démarrage » du README**

Dans `README.md`, remplacer le bloc de code de la section « Démarrage » (actuellement étapes 3-5 : `cp .env.example .env` / `npm run db:migrate` / `npm run dev`) par un flux Docker. Nouveau bloc :

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer les tests unitaires (aucune BDD requise)
npm run test

# 3. Configurer l'environnement (les valeurs par défaut matchent le docker-compose fourni)
cp .env.example .env   # puis renseigner les secrets JWT

# 4. Démarrer le MySQL local (prérequis : Docker Desktop)
docker compose up -d   # ou : npm run db:up

# 5. Appliquer les migrations (crée les tables)
npm run db:migrate

# 6. Démarrer le serveur en développement
npm run dev
```

Ajouter juste sous le bloc une note :

```markdown
> **Base de données locale** — Le `docker-compose.yml` fournit un MySQL 8
> (base `e_jdr`, root/root) persistant via le volume `ejdr-mysql-data`.
> `docker compose down` arrête la base sans perdre les données ;
> `docker compose down -v` réinitialise tout (supprime le volume).
> Les tests d'intégration (`npm run test:db`) sont indépendants : ils utilisent
> testcontainers et ne nécessitent pas ce conteneur.
```

- [ ] **Step 2 : Ajouter les scripts db:up/db:down au tableau des scripts du README**

Dans le tableau « Scripts » de `README.md`, après la ligne `npm run db:migrate`, ajouter deux lignes :

```markdown
| `npm run db:up` | Démarre le MySQL local (Docker). |
| `npm run db:down` | Arrête le MySQL local (données conservées ; `-v` pour réinitialiser). |
```

- [ ] **Step 3 : Ajouter un commentaire dans `.env.example`**

Dans `.env.example`, sous l'en-tête « Base de données MySQL », ajouter une ligne de commentaire avant `DB_HOST` :

```
# Ces valeurs correspondent au docker-compose.yml fourni (docker compose up -d).
```

- [ ] **Step 4 : Vérifier la cohérence de la doc**

Run: `grep -nE "docker compose|db:up|db:down|ejdr-mysql-data" README.md`
Expected: les nouvelles occurrences apparaissent (bloc démarrage, note BDD, tableau scripts).

- [ ] **Step 5 : Commit**

```bash
git add README.md .env.example
git commit -m "docs: workflow MySQL local via Docker (README + .env.example)"
```

---

## Self-Review

**Spec coverage** (chaque élément de la spec → une tâche) :
- docker-compose.yml (mysql:8, 3306, volume, healthcheck) → **Task 1** ✅
- scripts db:up/db:down → **Task 2** ✅
- migrations Drizzle, pas de seed → **Task 3** (db:migrate, aucun seed) ✅
- README + .env.example → **Task 5** ✅
- MySQL natif arrêté + Manual, réversible, après vérif → **Task 4** ✅
- code applicatif inchangé / test:db inchangé → aucune tâche ne touche `src/**` ni testcontainers ✅
- persistance des données (volume) → vérifiée en Task 3 Step 5 ✅

**Placeholder scan** : aucun TBD/TODO ; chaque step de code montre le contenu réel. ✅

**Type/nom consistency** : noms constants sur tout le plan — service `mysql`, conteneur `ejdr-mysql-local`, volume `ejdr-mysql-data`, base `e_jdr`, scripts `db:up`/`db:down`. ✅

**Ordre** : Task 4 (libérer 3306) est référencée comme prérequis dans Task 1/3 si conflit ; elle est placée après pour ne pas toucher au système avant d'avoir un compose fonctionnel, mais un renvoi explicite existe. Cohérent. ✅
