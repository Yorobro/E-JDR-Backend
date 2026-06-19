# Spec — Groupes d'amis (Friend Groups) — E-JDR

> **Date :** 2026-06-18
> **Branche :** `feat/friend-groups` (back ET front, créées des deux côtés)
> **Statut :** Design validé par l'utilisateur. **Implémentation PAS commencée.**
> **Contexte de reprise :** Ce spec a été rédigé en fin de session par un Claude qui n'aura
> pas le temps d'implémenter. Un autre Claude (autre compte) reprendra la conversation et
> exécutera. **Lis ce document en entier avant de coder.** Le même fichier existe à
> l'identique dans le repo front (`E-JDR-Frontend/docs/superpowers/specs/2026-06-18-friend-groups-design.md`).

---

## 1. Intention

Aujourd'hui, dans E-JDR, les **campagnes**, les **6 catalogues d'éléments de référence**
(formations, peuples, armes, armures, compétences, équipements) et les **fiches de
personnage** appartiennent à **un utilisateur** (`owner_id` / `game_master_id` → `users`).

On introduit une nouvelle entité **groupe d'amis (FriendGroup)** et on **déplace la
propriété** de ces ressources de l'utilisateur vers le groupe :

- Un **utilisateur appartient à plusieurs groupes** ; un **groupe contient plusieurs
  utilisateurs** (relation **N-N** via une table de membres).
- Les **campagnes** appartiennent à un **groupe** (`group_id`).
- Les **6 catalogues de référence** appartiennent à un **groupe** (`group_id`).
- Les **fiches de personnage** appartiennent à **un utilisateur ET un groupe**
  (`owner_id` user + `group_id` group). La fiche est créée dans le contexte d'un groupe ;
  le MJ d'une campagne voit ainsi **toutes les fiches du groupe** pour les intégrer.
- Les **sessions** restent rattachées à une campagne (`campaign_id`) et héritent du groupe
  via la campagne — **aucun changement de schéma sur les sessions**.

## 2. Décisions actées (NE PAS re-débattre — déjà validées avec l'utilisateur)

| # | Sujet | Décision |
|---|---|---|
| D1 | Données existantes | **Drop & recreate**, on repart sur des données propres (env dev/local). PAS de migration de données legacy, PAS de groupe perso auto. |
| D2 | Périmètre bascule → groupe | **Campagnes** + **6 catalogues de référence** passent à `group_id`. |
| D3 | Fiches de personnage | Double appartenance : **`owner_id` (user) conservé** + **`group_id` (group) ajouté**. |
| D4 | Rôles | **Rôles fins** : `ADMIN` au niveau **groupe** ; `MJ` au niveau **campagne** (créateur de la campagne = MJ) ; tout membre est **joueur** par défaut. |
| D5 | Créer une campagne | **Tout membre** du groupe peut créer une campagne et en devient automatiquement le **MJ**. |
| D6 | Gérer les catalogues | **Admin du groupe uniquement** (CRUD). Les autres membres ne font que **lire/piocher**. |
| D7 | Inviter / retirer des membres | **Tout membre** du groupe peut inviter et retirer des membres. |
| D8 | Mécanisme d'arrivée | **Invitation à accepter** : état « invitation en attente », l'invité accepte/refuse dans l'app avant d'être membre. |
| D9 | Contexte | **Sélecteur de groupe actif** (modèle workspace type Discord/Slack) : un groupe « actif » détermine ce qui s'affiche (campagnes/catalogues/fiches). |
| D10 | Accès aux fiches | **Voir** = tout le groupe. **Modifier** = propriétaire de la fiche **+** MJ d'une campagne où la fiche est liée. |
| D11 | Ordre de livraison | **Découpé en étapes vérifiables** (cf. §9). Le projet a l'habitude « back first ». |

## 3. Modèle de données (Backend, Drizzle MySQL)

> Rappel conventions repo : `char(36)` pour les ids (UUID string), `owner`/FK via
> `.references(() => …, { onDelete: … })`, noms de contraintes FK auto-générés par Drizzle
> **limités à 64 car.** (MySQL `ER_TOO_LONG_IDENT`) → **garder des noms de tables/colonnes
> courts** (cf. la feature reference qui a dû utiliser `sheet_armes`/`sheet_id`). Schéma
> source de vérité sous `src/infrastructure/persistence/drizzle/schema/*.ts`, agrégé dans
> `index.ts`. Migrations forward-only via `npm run db:generate` (cf. `db/MIGRATION.md`).
> ⚠️ Le `db:generate` peut devenir **interactif** quand on drop+add des colonnes sur une
> même table → en non-TTY ça échoue. **Contournement** : générer en 2 étapes (additif puis
> drops). Vu sur la feature reference.

### 3.1 Nouvelles tables

**`friend_groups`** (le groupe)
| Colonne | Type | Notes |
|---|---|---|
| `id` | char(36) PK | UUID |
| `name` | varchar(≤120) | nom du groupe, value object `FriendGroupName` |
| `created_by` | char(36) FK→users | créateur (devient admin) |
| `created_at` | timestamp | |

**`group_members`** (N-N user↔group + rôle de groupe)
| Colonne | Type | Notes |
|---|---|---|
| `group_id` | char(36) FK→friend_groups (cascade) | |
| `user_id` | char(36) FK→users (cascade) | |
| `role` | enum/varchar | `ADMIN` \| `MEMBER` (le « joueur » = MEMBER ; MJ n'est PAS ici, il est par campagne) |
| `created_at` | timestamp | |
| | **PK composite** (`group_id`, `user_id`) | un user a un seul rôle par groupe |

> Note : le rôle **MJ** n'est PAS stocké dans `group_members` — il découle du fait d'être
> `game_master_id` d'une campagne (cf. D4). `group_members.role` ne porte donc que
> `ADMIN`/`MEMBER`.

**`group_invitations`** (invitations en attente — D8)
| Colonne | Type | Notes |
|---|---|---|
| `id` | char(36) PK | |
| `group_id` | char(36) FK→friend_groups (cascade) | |
| `invited_user_id` | char(36) FK→users (cascade) | l'invité (utilisateur existant) |
| `invited_by` | char(36) FK→users | qui a invité |
| `status` | enum/varchar | `PENDING` \| `ACCEPTED` \| `DECLINED` |
| `created_at` | timestamp | |
| | **UNIQUE** (`group_id`, `invited_user_id`) sur status PENDING | éviter doublons d'invitation active |

> Décision d'implémentation laissée à l'exécutant : soit une ligne par invitation avec
> `status`, soit suppression de la ligne à l'acceptation (et création du `group_member`).
> Recommandé : garder la trace (`status`) pour l'historique, mais UNIQUE sur invitation
> PENDING active. L'invitation cible un **utilisateur existant** (par email/pseudo résolu
> en `user_id`).

### 3.2 Tables modifiées (D1 = drop & recreate, donc on réécrit le schéma, pas de data migration)

- **`campaigns`** : **`game_master_id` reste** (c'est le MJ de la campagne, D4) et on
  **ajoute `group_id` char(36) FK→friend_groups (cascade)**. Une campagne appartient à un
  groupe ET a un MJ (qui est un membre du groupe).
  → `campaigns(id, group_id FK, game_master_id FK→users, name, created_at)`.
- **6 catalogues** `formations`, `peoples`, `armes`, `armures`, `competences`,
  `equipements` : remplacer **`owner_id` (→users)** par **`group_id` (→friend_groups,
  cascade)**. `UNIQUE(owner_id, name)` devient **`UNIQUE(group_id, name)`** (un nom unique
  par groupe). Les catalogues sont la bibliothèque partagée du groupe.
- **`character_sheets`** : **conserver `owner_id` (→users)** ET **ajouter `group_id`
  (→friend_groups, cascade)** (D3). Une fiche = un propriétaire user + un groupe.
- **`campaign_characters`**, `sheet_armes`/`sheet_armures`/`sheet_competences`/
  `sheet_equipements` : **inchangées** structurellement (liaisons), mais les **règles
  d'autorisation** changent (ne lier que dans le même groupe — cf. §5).
- **`sessions`** : **inchangées**.

> Comme D1 = drop & recreate, l'exécutant peut **squasher** ou simplement ajouter les
> migrations nécessaires puis faire `npm run db:reset` + `db:bootstrap` + `db:migrate` en
> local. Pas d'obligation de préserver des lignes.

## 4. Architecture (rappel des règles à respecter — voir README de chaque repo)

**Backend (Node/TS, Clean Archi stricte, 4 couches) :**
- Nouvelle feature `friend-group` dans chaque couche : `domain/features/friend-group/`,
  `application/features/friend-group/` (abstractions/usecase/service), `infrastructure/
  persistence/mysql/features/friend-group/` (DAO pur + Mapper + Repository + factory
  `createFriendGroupRepositories`), `presentation/http/features/friend-group/` (controller +
  routes + mappers HTTP).
- **Un use case n'appelle jamais un autre use case.** Services factorisent. Écritures via
  **UnitOfWork** (enrichir `TransactionalRepositories` + fournir
  `createFriendGroupRepositories`). Lectures pures via repos injectés.
- **Result<T,E>** pour le métier ; exceptions pour le technique.
- Value objects domaine : `FriendGroupName`, `GroupRole` (ADMIN/MEMBER),
  `InvitationStatus`. Entités `FriendGroup`, `GroupMembership`, `GroupInvitation`.
- **Autorisation** : c'est le gros morceau. Introduire un **service d'autorisation de
  groupe** (ex. `GroupAccessService`) consultable par les use cases pour répondre :
  « cet user est-il membre/admin de ce groupe ? est-il MJ de cette campagne ? peut-il
  modifier cette fiche ? ». Centraliser pour éviter la dispersion des règles.
- Composition root : câbler les nouveaux repos/use cases/controllers dans `src/main.ts`
  (DI manuelle). Respecter `ejdr/file-size` (max 500 lignes) → splitter
  `buildXxxControllers.ts` si besoin (déjà fait ailleurs).

**Frontend (Kotlin Compose Desktop, Clean Archi, Koin, Nav3) :**
- Nouvelle feature `friendgroup/` dans chaque couche (`domain`, `application`,
  `infrastructure/http/features/friendgroup`, `presentation/features/friendgroup`).
- `ReferenceModule`-style : un `FriendGroupModule` Koin enregistré dans `AppKoin`.
- Use cases en `fun interface` + impls ; `FriendGroupHttpRepository`/`Mapper`/DTOs
  (enveloppe `{items}` cohérente avec l'existant).
- **Sélecteur de groupe actif (D9)** : un **état global** de groupe actif (probablement dans
  `RootState` ou un holder dédié injecté), persisté localement (cf. `ThemeFileRepository`
  pour le pattern de persistance fichier) pour retrouver le groupe au redémarrage. ⚠️
  Rappels mémoire : les state-holders racine **ne doivent PAS** être des `androidx
  ViewModel` (crash) — utiliser le pattern `RootState` existant. `koinViewModel { }` n'a pas
  de param `key`.
- Les écrans **campagnes / catalogues / fiches** filtrent sur le **groupe actif**. Quand le
  groupe actif change → recharger ces écrans.
- Nouveaux écrans : liste de mes groupes, détail/membres d'un groupe, invitations reçues,
  inviter un membre. Routes Nav3 ajoutées dans `Route` (sealed) + entries par feature.
- Design system existant (`AppTheme`, atomic/molecule/organism, `AppDropdown` pour le
  sélecteur, `AppDialog` pour invitations). Tout en **français**.

## 5. Règles d'autorisation (récapitulatif normatif)

| Action | Qui | Règle |
|---|---|---|
| Créer un groupe | tout user authentifié | le créateur devient `ADMIN` (ligne `group_members`). |
| Inviter un membre | **tout membre** du groupe (D7) | invitation `PENDING` vers un user existant. |
| Retirer un membre | **tout membre** du groupe (D7) | (décision laissée : empêcher de retirer le dernier admin / soi-même = à gérer proprement). |
| Accepter/refuser invitation | l'invité uniquement | `ACCEPTED` → crée `group_member` (role `MEMBER`). |
| Promouvoir/rétrograder admin | **admin** du groupe | (déduit de D4 ; détail laissé à l'exécutant — au minimum le créateur est admin). |
| Créer une campagne | **tout membre** (D5) | `campaign.group_id` = groupe actif, `game_master_id` = créateur (= MJ). |
| Gérer les catalogues (CRUD réf.) | **admin** du groupe (D6) | les non-admins lisent seulement. |
| Lier un élément réf. à une fiche | propriétaire de la fiche (et MJ, cf. modif) | l'élément et la fiche doivent appartenir au **même groupe**. |
| Créer une fiche | tout membre | `owner_id` = user courant, `group_id` = groupe actif. |
| **Voir** une fiche | **tout membre** du groupe (D10) | nécessaire pour que le MJ intègre les fiches. |
| **Modifier** une fiche | **propriétaire** OU **MJ d'une campagne où la fiche est liée** (D10) | |
| Intégrer une fiche dans une campagne | **MJ** de la campagne | pioche parmi **toutes les fiches du groupe** de la campagne. |
| Voir campagnes/catalogues/fiches | membres du groupe | scoping systématique par `group_id` = groupe actif. |

**Invariant transverse :** toute ressource manipulée doit appartenir au groupe dans
lequel l'utilisateur agit, et l'utilisateur doit être membre de ce groupe. Vérifier
côté backend (jamais se fier au front).

## 6. API HTTP (backend) — esquisse (routes à finaliser par l'exécutant, rester cohérent avec l'existant)

Groupes & membres :
- `POST /groups` — créer un groupe (créateur = admin). → 201
- `GET /groups` — lister mes groupes (où je suis membre). → 200
- `GET /groups/:id` — détail (membres + mon rôle). → 200 (membre only)
- `DELETE /groups/:id` — supprimer (admin only). → 204
- `DELETE /groups/:id/members/:userId` — retirer un membre (tout membre, D7). → 204
- `PATCH /groups/:id/members/:userId` — changer rôle ADMIN/MEMBER (admin only). → 200

Invitations :
- `POST /groups/:id/invitations` — inviter (body : email/pseudo de l'invité). → 201
- `GET /invitations` — mes invitations reçues (PENDING). → 200
- `POST /invitations/:id/accept` — accepter → crée le membership. → 200/201
- `POST /invitations/:id/decline` — refuser. → 200

Bascule de scoping (modifs sur l'existant) :
- `POST /campaigns` — exige `groupId` (et vérifie membership) ; MJ = créateur.
- `GET /campaigns?groupId=…` — scoping par groupe.
- `POST/GET/DELETE /reference/:type` — scoping par groupe ; **CRUD réservé admin** (D6).
- `POST/GET /character-sheets` — `groupId` requis à la création ; listing scoping groupe.
- Intégration fiche↔campagne : la liste « fiches intégrables » = **toutes les fiches du
  groupe de la campagne** (au lieu de « mes fiches »).

Codes d'erreur à prévoir (style existant) : `NOT_GROUP_MEMBER` (403), `NOT_GROUP_ADMIN`
(403), `NOT_CAMPAIGN_GM` (403), `GROUP_NOT_FOUND` (404), `INVITATION_NOT_FOUND` (404),
`INVITATION_ALREADY_RESOLVED` (409), `ALREADY_MEMBER` (409), `INVALID_GROUP_NAME` (400),
`CANNOT_REMOVE_LAST_ADMIN` (409 — si retenu).

## 7. Tests (respecter les seuils CI)

- **Back** (Vitest, seuil 70%) : tests domaine (`FriendGroupName`, `GroupRole`,
  invariants invitation), use cases (création groupe, invitation/accept/decline,
  scoping/autorisations campagnes+catalogues+fiches), intégration HTTP (`groupRoutes`,
  `invitationRoutes`, et MAJ des routes campaign/reference/character-sheet pour le scoping).
  Tests DAO Testcontainers si pertinents (Docker requis, sinon laissé à la CI).
- **Front** (JUnit5/MockK, Kover ≥60%) : repository HTTP, use cases, ViewModels (liste
  groupes, invitations, sélecteur de groupe actif, et MAJ des VMs campagnes/catalogues/
  fiches pour le scoping). Exclure les `page`/`component`/nav-entries de Kover (comme pour
  reference).

## 8. Points ouverts / décisions déléguées à l'exécutant (non bloquants)

1. Représentation des rôles en base : enum MySQL vs varchar + check applicatif (le projet
   utilise plutôt du varchar + VO domaine — suivre cette habitude).
2. Garde-fous : interdire de retirer le dernier admin / de se retirer soi-même si dernier
   admin → `CANNOT_REMOVE_LAST_ADMIN`. À implémenter proprement.
3. Suppression de groupe : que deviennent campagnes/catalogues/fiches du groupe ? (cascade
   sur campagnes/catalogues via FK ; pour les fiches, `group_id` est obligatoire → décider :
   cascade delete de la fiche, ou interdire la suppression d'un groupe non vide). **Reco :
   interdire la suppression d'un groupe tant qu'il contient des campagnes/fiches**, ou
   exiger une confirmation explicite. À trancher à l'implémentation.
4. Persistance du « groupe actif » côté front (fichier sous `%APPDATA%/E-JDR/`).
5. Comportement quand l'utilisateur n'a **aucun** groupe : écran d'onboarding « crée ou
   rejoins un groupe » avant d'accéder à campagnes/catalogues/fiches.

## 9. Plan de livraison incrémental (D11) — à détailler via le skill writing-plans

- **Étape 1 — Fondations groupe (back puis front).** Entité `FriendGroup` + `group_members`
  + `group_invitations` ; use cases créer groupe / inviter / accepter / refuser / lister mes
  groupes / lister membres / retirer membre ; rôles ADMIN/MEMBER ; `GroupAccessService`.
  Front : feature friendgroup, écrans groupes + invitations, **sélecteur de groupe actif**
  (state global persisté). Vérifiable : on peut créer un groupe, inviter, accepter, voir ses
  groupes, choisir un groupe actif.
- **Étape 2 — Bascule campagnes + catalogues vers `group_id`.** Schéma + use cases +
  scoping + autorisations (créer campagne = tout membre/MJ ; CRUD catalogues = admin).
  Front : campagnes et catalogues filtrés par groupe actif. Vérifiable end-to-end.
- **Étape 3 — Fiches liées au groupe + accès MJ.** Ajout `character_sheets.group_id` ;
  visibilité « tout le groupe », édition « proprio + MJ » ; intégration campagne pioche
  parmi toutes les fiches du groupe. Front : création fiche dans le groupe actif, vue MJ.
  Vérifiable end-to-end.

Chaque étape : back d'abord, puis front ; `./gradlew verify` et `npm run test`/`lint`
verts ; runtime validé localement (MySQL80 sur :3306, back `npm run dev`, front
`.\gradlew.bat run`).

## 10. État de départ (pour l'exécutant)

- Repos propres sur `main` au moment de la création de branche ; **branche
  `feat/friend-groups` créée des deux côtés** (back + front).
- Back v1.5.0, front v1.12.0. Toutes les features précédentes (auth, campaigns, sessions,
  character-sheets, reference-elements) sont sur `main`.
- Modèle de propriété actuel à faire évoluer : `campaigns.game_master_id→users`,
  `character_sheets.owner_id→users`, 6 catalogues `owner_id→users` (UNIQUE(owner_id,name)).
- Toolchain local validé : Node 22.16, Java 21 Temurin, MySQL 8.0.43 (service `MySQL80`,
  db `e_jdr`, root/root). **Docker absent** → `test:db` non lançable localement.

---

**Prochain pas (pour le Claude qui reprend) :** lire ce spec, demander confirmation rapide
à l'utilisateur si un point ouvert (§8) le bloque, puis invoquer le skill **writing-plans**
pour produire le plan d'implémentation détaillé de l'**Étape 1**, et exécuter en TDD.
