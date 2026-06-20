# Édition des éléments de référence + cartes enrichies — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** (1) Pouvoir MODIFIER un élément de référence (formation, peuple, arme, armure, compétence, équipement) — nom + attributs spécifiques — en plus de créer/supprimer. (2) Sur la page liste d'un type, chaque carte affiche son contenu spécifique (armure→protection, formation→stat+bonus+compétences, peuple→stat+bonus, autres→nom).

**Architecture:** Back : nouveau use case Update reference (admin-only, remplacement complet) + endpoint PUT, repo gagne `update`, formation_competences gagne `deleteByFormation` (remplacement = delete+reinsert dans la transaction). Front : repo/usecase/viewmodel `update`, `EditReferenceDialog` (clone pré-rempli de Create) déclenché par une icône éditer sur `ReferenceCard` ; carte enrichie par type (compétences résolues ids→noms via le catalogue déjà chargé).

**Tech Stack:** Back Node/TS, Express, Drizzle/MySQL, Vitest. Front Kotlin/Compose, Ktor, JUnit5.

## Global Constraints
- Branche `feat/reference-edit` (déjà créée, depuis main à jour) sur les DEUX repos.
- Édition réservée à l'**admin du groupe** (`GroupAccessService.requireAdmin`), comme create/delete.
- **Remplacement complet** : le PUT envoie l'état complet (nom + champs selon le type) ; le back remplace tout. Pour une formation, les compétences sont entièrement remplacées (delete toutes + reinsert la nouvelle liste) dans la transaction.
- Le **type ne change pas** (l'endpoint porte `:type`, une armure reste une armure).
- Unicité `(group_id, name)` à respecter à l'édition aussi (autoriser le même nom si c'est le même item).
- Cartes : compétences d'une formation affichées par NOM, résolues côté front via le catalogue compétences déjà chargé (`availableCompetences`). Aucun changement back pour les cartes.
- Lint : back `ejdr/parameter-count` 6 (objets deps), `file-size` 500 ; front detekt LongMethod 80 / file-size 500.
- Hooks husky/prettier/commitlint actifs.
- Pas de migration DB (tous les champs existent déjà).

---

## Phase A — Back : Update reference
- **A1** Port + DAO + repo `update` : `ReferenceRepository.update(item)` ; `ReferenceDao.update(id, row)` (`db.update(table).set(row).where(eq(table.id,id))`) ; `MysqlReferenceRepository.update`. Le fake repo (tests) gagne `update`. `FormationCompetenceLinkRepository.deleteByFormation(formationId)` + DAO `deleteByFormation` + impl + fake.
- **A2** Use case : `UpdateReferenceItemCommand { itemId, actorId, groupId, name, stat?, bonus?, competenceIds?, protectionPoints? }` + `UpdateReferenceItemUseCase` + impl. Logique : requireAdmin(actorId, groupId) ; findById(itemId) → NotFound sinon ; vérifier itemId appartient au groupe ; valider nom (ReferenceName) + unicité (autoriser nom inchangé) ; reconstruire l'item (restore avec nouvelles valeurs : statBonus si stat fournie, protectionPoints) ; transaction : repo.update(item) + (formation) deleteByFormation puis link chaque competenceId vérifiée du groupe. Renvoie ReferenceItemView. Tests : update nom ; update formation (stat+bonus+compétences remplacées) ; update armure (protection) ; non-admin → refusé ; itemId inconnu → NotFound ; compétence hors groupe → refus.
- **A3** HTTP : route `PUT /reference/:type/:id` → `ReferenceController.update` (parse body name/stat/bonus/competenceIds/protectionPoints comme create, + :id, renvoie l'item serialisé). Tests intégration : PUT modifie ; non-admin 403 ; 404 si inconnu.
- **A4** Câblage `buildReferenceController` + main (deps update, formationDeps pour formations comme create).

## Phase B — Front : Update reference (modèle + UI)
- **B1** Port `ReferenceRepository.update(type, itemId, name, stat, bonus, competenceIds, protectionPoints)` + `ReferenceHttpRepository.update` (PUT) + DTO `UpdateReferenceRequestDto` (réutiliser la forme de Create) + `UpdateReferenceItemUseCase`/impl + module Koin.
- **B2** `ReferenceListViewModel.update(itemId, name, stat, bonus, competenceIds, protectionPoints)` → appelle le use case, recharge la liste. État `pendingEdit: ReferenceItem?` géré par la page.
- **B3** `EditReferenceDialog` : cloner `CreateReferenceDialog` mais pré-rempli depuis un `ReferenceItem` (nom, stat, bonus, competenceIds cochées, protectionPoints) ; même champs conditionnels par type ; `onConfirm` renvoie l'état complet. (Possibilité : généraliser CreateReferenceDialog avec un `initial: ReferenceItem? = null` + titre/confirmLabel paramétrés, pour DRY.)
- **B4** `ReferenceCard` : ajouter une icône **éditer** (crayon) à côté de supprimer, callback `onEdit`. `ReferenceListPage` : state `pendingEdit`, ouvre EditReferenceDialog pré-rempli, appelle `viewModel.update`.
- Tests ViewModel : update transmet les champs + recharge.

## Phase C — Front : cartes enrichies par type
- **C1** `ReferenceCard` : sous le nom, afficher selon `type` :
  - ARMURE : "Protection : {protectionPoints ?: 0} pt".
  - FORMATION : "Stat : {statLabel} (+{bonus})" si stat ; "Compétences : {noms joints}" (résolus depuis `competenceIds` via un `Map<String,String>` id→nom fourni par la page depuis `availableCompetences`).
  - PEUPLE : "Stat : {statLabel} (+{bonus})" si stat.
  - ARME/COMPETENCE/EQUIPEMENT : rien de plus (nom seul).
  - statLabel : réutiliser `StatKeys.ORDERED`/un libellé FR (dexterite→Dextérité…). Vérifier s'il existe un mapping slug→label réutilisable (sinon petit helper).
- **C2** `ReferenceListPage`/ViewModel : exposer le catalogue compétences (déjà chargé pour formation) comme `Map<id,name>` et le passer aux cartes formation. Pour les pages non-formation, map vide (pas besoin).
- detekt : si ReferenceCard devient longue, extraire un sous-composable par type (ex `ReferenceCardDetails`).

## Phase D — Vérif + runtime + commit/push
- Back `npm test`+lint+tsc ; Front `gradlew verify`.
- Runtime : créer une formation (stat+compétences), l'**éditer** (changer stat/bonus/compétences) → vérifier persistance ; éditer une armure (protection) ; vérifier que la carte affiche protection / stat / compétences selon le type ; non-admin ne voit pas/ne peut pas éditer (à confirmer : l'icône éditer doit-elle être masquée pour non-admin ? cf. delete actuel — s'aligner sur le comportement de l'icône supprimer).
- Commits back+front sur `feat/reference-edit` ; push.

## Fichiers principaux
**Back** : `ReferenceRepository.ts` (port) + `ReferenceDao.ts`/`MysqlReferenceRepository.ts` (update) ; `FormationCompetenceLinkRepository.ts`/DAO/impl (deleteByFormation) ; `ReferenceCatalogueUseCases.ts` + `ReferenceCatalogueUseCaseImpls.ts` (UpdateReferenceItem) ; `ReferenceController.ts` + `referenceRoutes.ts` ; `buildReferenceController.ts` ; fakes/tests.
**Front** : `application/.../ReferenceRepository.kt` + `ReferenceUseCases.kt`/impl ; `infrastructure/http/.../ReferenceHttpRepository.kt` + `dto/ReferenceDtos.kt` ; `di/...ReferenceModule` ; `presentation/features/reference/ReferenceListViewModel.kt` ; `component/ReferenceComponents.kt` (ReferenceCard + Edit dialog) ; `page/ReferenceListPage.kt` ; tests.

## Réutilisation
- Create reference (back+front) = modèle direct pour Update (mêmes champs, +itemId).
- `requireAdmin`, `ReferenceItem.restore`, `ReferenceMapper`, validation nom : déjà là.
- `CreateReferenceDialog` + `CompetencePicker` (front) : à généraliser/cloner pour l'édition.
- `availableCompetences` (ViewModel front) : déjà chargé pour formation → source des noms de compétences sur la carte.
- `ReferenceType` (linkable, slug, labels) pour le conditionnel d'affichage.

## Pièges
- Unicité nom à l'update : ne pas rejeter si le nom est inchangé (même item).
- Formation : remplacement des compétences = delete+reinsert DANS la transaction (atomique).
- Le fake repo front/back doit gagner `update`/`deleteByFormation` sinon tests cassent.
- Cartes : page non-formation → pas de catalogue compétences à charger (éviter requête inutile).
- Icône éditer : cohérence d'accès avec l'icône supprimer (admin only).

## Vérification end-to-end
1. Back tests+lint+tsc ; front gradlew verify.
2. Redémarrer back (ts-node sans hot reload) + relancer front.
3. Éditer formation/peuple/armure → persistance OK ; cartes affichent le bon contenu par type.
