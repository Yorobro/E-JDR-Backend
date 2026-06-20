# Refonte profil + rôles & contrôle d'accès — Design

**Date** : 2026-06-20
**Périmètre** : back (E-JDR-Backend) + front (E-JDR-Frontend)
**Branche** : `feat/roles-and-profile` (back depuis `develop`, front depuis `main`)

## Objectif

Trois changements liés au cycle de vie d'un utilisateur dans l'application :

1. **Page profil** — la page d'accueil utilisateur devient une vraie page de profil : voir
   son email, le changer, changer son mot de passe, et se déconnecter (déconnexion déplacée
   depuis le header).
2. **Gating de navigation** — tant qu'aucun groupe d'amis n'est actif, les entrées de
   navigation Formations/Fiches/Campagnes sont **cachées**.
3. **Rôles & lecture seule** — introduction d'un 3ᵉ rôle de groupe `MJ`. ADMIN et MJ peuvent
   éditer le contenu du groupe ; MEMBER consulte en lecture seule (sauf ses propres fiches).

---

## Section 1 — Page profil utilisateur

### Comportement

La page `UserPage` (`Route.Home`) affiche :

- L'email courant (déjà présent aujourd'hui).
- Bouton **« Changer d'email »** → dialog (nouvel email) → applique directement. **Pas** de
  reconfirmation par mot de passe (l'utilisateur est déjà authentifié).
- Bouton **« Changer le mot de passe »** → dialog (mot de passe actuel + nouveau mot de passe)
  → le back vérifie l'ancien avant d'appliquer.
- Bouton **« Déconnexion »** (déplacé ici, voir Section 2).

Après un changement réussi (email ou mot de passe) : l'utilisateur **reste connecté** sur ce
poste, un message de succès s'affiche. Aucune invalidation de session / multi-session (le projet
n'a pas de « déconnecter partout »).

### Back (nouveau)

- `PATCH /me/email` → `ChangeEmailUseCase`
  - Valide le nouvel email via le value object `Email` (→ 400 `INVALID_EMAIL` si malformé).
  - Vérifie l'unicité (email pas déjà pris par un autre compte → 409 si conflit).
  - Met à jour le credential du user courant.
- `PATCH /me/password` → `ChangePasswordUseCase`
  - Vérifie le **mot de passe actuel** via bcrypt (→ 401/400 si incorrect).
  - Valide la robustesse du nouveau via `PlainPassword` (→ 400 si trop faible).
  - Re-hash et met à jour le credential.
- Routes authentifiées (middleware auth), `userId` issu de la session.

### Front (nouveau)

- `AuthRepository` : 2 méthodes `changeEmail(newEmail)` et `changePassword(current, new)`.
- 2 use cases : `ChangeEmailUseCase`, `ChangePasswordUseCase` (contrat `Result<Unit, AuthError>`).
- `UserViewModel` : passe de read-only à éditable — expose états de chargement/erreur/succès par
  action, et les méthodes `changeEmail` / `changePassword`.
- `UserPage` : 2 dialogs (réutiliser le pattern de dialog existant) + le bouton déconnexion.

---

## Section 2 — Déconnexion + gating de navigation

### Déconnexion déplacée

- Retirer le bouton « Déconnexion » de `AppTopBar` (composant partagé, rendu partout
  aujourd'hui via `presentation/shared/component/organism/AppTopBar.kt`).
- Le placer sur `UserPage`. Le câblage final reste identique : `App.kt` exécute
  `logout()` puis `resetTo(Route.Login)`. Seul l'emplacement du déclencheur change.

### Gating de navigation (boutons cachés sans groupe actif)

- Aujourd'hui `UserNavEntries.kt` construit `AppTopBar` avec **tous** les callbacks → tous les
  boutons sont affichés en dur.
- Nouveau : les entrées **Formations (Mes éléments), Fiches (Mes fiches), Campagnes** ne sont
  rendues **que si un groupe est actif** (`ActiveGroupState.activeGroupId != null`).
- **Toujours visibles** quel que soit l'état : Groupes, Invitations, Paramètres (et Retour) —
  c'est par là qu'on active un groupe.
- Implémentation : la couche qui construit `AppTopBar` observe `activeGroupState.activeGroupId` ;
  les callbacks `onReferences` / `onCharacterSheets` / `onCampaigns` valent `null` (donc bouton
  masqué via le mécanisme `TopBarAction` existant) tant qu'aucun groupe n'est actif.
- Le `needsGroup` au niveau page (déjà en place dans les ViewModels liste) **reste** comme filet
  de sécurité si on atteint une route par un autre chemin.

---

## Section 3 — Rôle MJ + contrôle d'accès par rôle

### 3a. Nouveau rôle de groupe `MJ`

- `GroupRole` (back domaine) : valeurs `ADMIN`, `MJ`, `MEMBER`.
- **Migration BDD additive** : la colonne `role` des memberships accepte désormais `MJ`. Aucun
  membership existant n'est modifié ; le créateur du groupe reste `ADMIN`.
- **Attribution** : l'ADMIN change les rôles via la page détail du groupe (use case
  `ChangeMemberRole` existant) — on ajoute `MJ` aux choix proposés côté front. La protection
  « dernier admin » existante reste inchangée.

### 3b. Matrice d'autorisation (règle métier de référence)

| Ressource | ADMIN | MJ | MEMBER |
|---|---|---|---|
| **Gérer le groupe** (inviter, exclure, changer rôles, supprimer) | éditer | lecture | lecture |
| **Catalogues de référence** (formations, armes, peuples, sorts…) | éditer | éditer | lecture |
| **Campagnes & sessions** | éditer | éditer | lecture |
| **Fiches de personnage** | éditer toutes | éditer toutes | éditer **les siennes** / lecture pour les autres |

### 3c. Back — application de la matrice (source de vérité)

- Nouvelle méthode `GroupAccessService.requireEditor(userId, groupId)` → succès si rôle ∈
  {ADMIN, MJ}, sinon `403` (`NOT_GROUP_EDITOR` ou réutilisation d'un code existant à décider en
  implémentation).
- Câblage :
  - **Catalogues** (`CreateReferenceItem` / `Update` / `Delete`) : `requireAdmin` → `requireEditor`.
  - **Campagnes & sessions** (création, édition) : `requireMember` → `requireEditor`.
  - **Fiches** :
    - Création (`CreateCharacterSheet`) : reste ouverte à tout membre (un MEMBER crée les
      siennes), la fiche est liée à son `ownerId`.
    - Édition (`UpdateCharacterSheet`) : autorisé si **propriétaire** OU **éditeur du groupe
      (ADMIN/MJ)**. **Change la règle existante** « propriétaire OU MJ-de-campagne » → désormais
      « propriétaire OU ADMIN/MJ-du-groupe ».
    - Suppression (`DeleteCharacterSheet`) : même règle que l'édition — **propriétaire** OU
      **ADMIN/MJ**. (« Éditer les siennes » pour un MEMBER inclut supprimer les siennes,
      cohérent avec le comportement propriétaire actuel.)
- Le back **garantit** la règle ; le front ne fait que masquer l'UI.

### 3d. Front — lecture seule selon le rôle

- Le rôle courant (`myRole`) est déjà renvoyé par `GET /groups/:id`, mais seule la page Groupe
  l'utilise. Il faut le rendre disponible **globalement** pour le groupe actif.
- **Approche** : étendre `ActiveGroupState` pour exposer, en plus de `activeGroupId`, le rôle de
  l'utilisateur dans le groupe actif : `activeGroupRole: StateFlow<String?>` (chargé via
  `GET /groups/:id` à l'activation d'un groupe), + un dérivé `canEdit = role ∈ {ADMIN, MJ}`.
- Écrans masquant/désactivant leurs actions d'édition selon `canEdit` :
  - **Catalogues** (`ReferenceListPage`) : FAB création + boutons éditer/supprimer cachés si
    non-éditeur.
  - **Campagnes** (`CampaignListPage` / `CampaignDetailPage`) : FAB + actions d'édition cachés
    si non-éditeur.
  - **Fiches** (`MyCharacterSheetsPage` / `CharacterSheetDetailPage`) : bouton éditer visible si
    `canEdit` **OU** propriétaire de la fiche.
- Si une requête d'édition part malgré tout sans droit, le back renvoie `403` (géré par les
  contrats `Result` existants).

### 3e. Périmètre & risques

- Migration BDD additive, à valider d'abord sur l'environnement de dev (Vertex) avant la prod.
- Le « MJ de campagne » (`gameMasterId`) **reste** pour la logique de campagne, mais n'est plus
  le vecteur d'autorisation d'édition des fiches — c'est désormais le rôle de groupe. À
  documenter dans le code pour éviter la confusion entre les deux notions de « MJ ».

---

## Hors périmètre (YAGNI)

- Pas de « déconnecter toutes les sessions » / gestion multi-appareils.
- Pas de reconfirmation par mot de passe pour le changement d'email.
- Pas de dérivation automatique du rôle MJ depuis les campagnes (attribution manuelle par
  l'ADMIN uniquement).
- Pas de refonte visuelle au-delà de ce qui est nécessaire aux nouvelles actions.
