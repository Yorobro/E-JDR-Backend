# Fiche : défauts, PV/Protection dérivés, armures protégées, compétences via formation — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps en checkbox.

**Goal:** Appliquer 6 ajustements métier à la fiche de personnage : défauts de création (niveau 1, stats 0, PM 0), PV = 10 + vigueur totale (dérivé, lecture seule), Protection = somme des points de protection des armures liées (dérivé, lecture seule), armures dotées de points de protection, et compétences 100% dérivées de la formation (onglet en lecture seule, picker N-N retiré).

**Architecture:** PV et Protection sont des valeurs **dérivées calculées côté back** (réutilisées comme PV max / armure, et nécessaires au PDF exporté) — calculées à la lecture (`GetCharacterSheet`) et dans l'export, **jamais stockées en dur** (pas de désync). Le back connaît déjà la vigueur totale (resolver formation/peuple) et charge les armures liées. Le front affiche PV/Protection en lecture seule. Compétences = champ dérivé de la formation déjà résolu côté back ; le front retire le picker N-N.

**Tech Stack:** Back Node/TS, Express, Drizzle/MySQL, Vitest. Front Kotlin/Compose, Ktor, JUnit5.

## Global Constraints
- Migration Drizzle **additive, forward-only**, prochaine = **0009** (`ALTER TABLE armures ADD points_de_protection int` nullable). Appliquée SANS reset.
- PV = `10 + vigueurTotale` où vigueurTotale = vigueur de base (0 si null) + bonus peuple + bonus formation ciblant `vigueur`. Lecture seule.
- Protection = somme des `points_de_protection` des armures liées à la fiche (0 si aucune). Lecture seule.
- Défauts À LA CRÉATION uniquement (pas en update/restore) : niveau=1, dexterite/intelligence/perception/social/vigueur=0, pointsDeMagie=0.
- Compétences : onglet fiche en lecture seule, 100% issues de `formation.competences`. Plus de lier/délier manuel. Table `sheet_competences` conservée mais non utilisée pour les compétences (laissée en place, ignorée).
- Calcul dérivé centralisé back (DRY) : une fonction `computeDerivedStats(detail, formation, peuple, armures)` réutilisée par GetCharacterSheet ET l'export PDF.
- Lint maison : `ejdr/parameter-count` max 6 (objets deps), `ejdr/file-size` 500, `ejdr/function-size` 100.
- Hooks husky/prettier/commitlint actifs. Branche : continuer sur `feat/pdf-character-sheet-layout`.

---

## Phase A — Back : défauts de création
- **A1** `CharacterSheet.ts` : ajouter une constante `CREATION_DEFAULTS` (niveau:1, dexterite/intelligence/perception/social/vigueur:0, pointsDeMagie:0) et l'appliquer dans `create()` (merge `{...EMPTY_DETAILS, ...CREATION_DEFAULTS, ...params}`). NE PAS toucher `restore()`/`update()` (sinon casse les null voulus). Test domaine : une fiche créée a niveau=1, stats=0, PM=0 ; restore d'un snapshot null garde null.
- Note : `CreateCharacterSheetUseCaseImpl` inchangé (les défauts remontent de l'entité). Front : aucun défaut (il affiche ce que renvoie l'API).

## Phase B — Back : armures avec points de protection
- **B1** Schéma `reference.schema.ts` : table `armures` quitte `referenceColumns` générique → colonnes inline + `points_de_protection: int("points_de_protection")` (nullable). Migration 0009 générée + appliquée sans reset. Attention `ReferenceRow`/DAO générique (cf. ce qui a été fait pour formations/peoples stat/bonus en 0008 : `ReferenceRow` a déjà `stat?`/`bonus?` optionnels → ajouter `protectionPoints?: number|null` au type explicite).
- **B2** Domaine `ReferenceItem` : ajouter `protectionPoints?: number|null` au snapshot + create/restore (optionnel, null pour non-armures). VO ? non, simple champ entier ≥ 0 validé à la création.
- **B3** Application : `ReferenceItemView` + create reference acceptent `protectionPoints` (armures only, comme stat/bonus pour formations). Mapper persistance round-trip. Tests create/list armure avec protection.
- **B4** HTTP `ReferenceController.create` : parse `protectionPoints` du body ; `serialize` le renvoie. Test intégration.

## Phase C — Back : PV & Protection dérivés (lecture + export)
- **C1** Créer `computeDerivedStats` (helper application, ex `src/application/features/character-sheet/usecases/computeDerivedCharacterStats.ts`) : prend (detail, formation résolu, peuple résolu, armuresLiées: {protectionPoints}[]) → `{ pointsDeVie, protection }`. PV = 10 + vigueurTotale ; protection = somme protectionPoints. Test unitaire (vigueur null→PV 10 ; vigueur 3 + bonus 2 → PV 15 ; 2 armures 2+3 → protection 5 ; aucune armure → 0).
- **C2** `GetCharacterSheetUseCaseImpl` : charge les armures liées (sheetArmures.findItemsBySheet) + résout formation/peuple (déjà fait), appelle computeDerivedStats, et renvoie `pointsDeVie`/`protection` calculés dans le detail (override les valeurs stockées). Injecter sheetArmures dans ses deps (objet). Test : detail renvoie PV/protection calculés.
- **C3** Export PDF (`ExportCharacterSheetPdfUseCaseImpl`) : il charge DÉJÀ formation/peuple + sheetArmures. Appliquer computeDerivedStats pour que le PDF montre PV/Protection corrects (passer les valeurs dérivées au detail/references). Test : pdf généré avec valeurs dérivées (au moins ne casse pas + référence capturée).
- **C4** Update (`UpdateCharacterSheetUseCaseImpl`) : ignorer `pointsDeVie`/`protection` envoyés par le client (ne pas les persister depuis l'input — ce sont des dérivés). Vérifier que l'update ne les écrase pas avec des valeurs front. (Optionnel : les recalculer aussi, mais comme GET recalcule, suffit de ne pas faire confiance à l'input.)

## Phase D — Front : PV/Protection lecture seule + défauts affichés
- **D1** `CharacterSheetSections.kt` `CombatSection` : remplacer les `NumberCell` de Points de vie et Protection par `ReadCellPublic` (lecture seule), valeurs = `sheet.pointsDeVie`/`sheet.protection` (déjà calculées par le back). Points de magie reste éditable. FormState : ne plus envoyer pointsDeVie/protection au PUT (ou les laisser, le back les ignore — préférer ne pas les inclure).
- **D2** Vérifier que les défauts (niveau 1, stats 0, PM 0) s'affichent bien (rien à coder front, juste valider via run).

## Phase E — Front : compétences dérivées uniquement
- **E1** `ReferenceType.kt` : `COMPETENCE.linkable = false`. Impact : `CharacterSheetDetailViewModel.linkableTypes` exclut COMPETENCE (plus de listSheetReferences/linkRef/unlinkRef compétences).
- **E2** `CharacterSheetSections.kt` `CompetencesSection` : retirer `LinkedReferenceSection(COMPETENCE,...)`, n'afficher QUE les compétences dérivées de la formation (`formation.competences`, badge « via <formation> »), avec « — » si aucune. Lecture seule, aucun bouton.
- **E3** Vérifier qu'aucune autre UI ne suppose COMPETENCE linkable (ReferenceHub reste : on peut toujours créer des compétences au catalogue, c'est la liaison fiche qui disparaît).

## Phase F — Vérif & runtime
- **F1** Back `npm test` + lint + tsc verts ; Front `gradlew verify` vert.
- **F2** Migration 0009 appliquée sans reset ; relancer back+front ; runtime : créer fiche (niveau 1, stats 0, PM 0 par défaut), créer armure avec protection, la lier → Protection = somme ; mettre vigueur → PV = 10+vigueur(+bonus) ; ajouter formation → compétences apparaissent en lecture seule, pas de picker.
- **F3** Commit (déjà par tâche) ; push sur `feat/pdf-character-sheet-layout`.

## Fichiers principaux
**Back créer** : `computeDerivedCharacterStats.ts` (+ test), migration `0009_*.sql`.
**Back modifier** : `CharacterSheet.ts` (défauts), `reference.schema.ts` (armures), `ReferenceItem.ts`, `ReferenceItemView.ts`, create reference use case + `ReferenceController.ts`, `ReferenceMapper.ts` + `ReferenceDao.ts` (ReferenceRow), `GetCharacterSheetUseCaseImpl.ts` (deps + dérivés), `ExportCharacterSheetPdfUseCaseImpl.ts`, `UpdateCharacterSheetUseCaseImpl.ts`, câblage `buildCharacterSheetControllers.ts`/`main.ts` + fakes/tests.
**Front modifier** : `ReferenceType.kt`, `CharacterSheetSections.kt` (CombatSection + CompetencesSection), `CharacterSheetDetailViewModel.kt`, `ReferenceDtos.kt` (protectionPoints), `CreateReferenceDialog`/`ReferenceComponents.kt` (champ protection armure) + `ReferenceListViewModel`, mappers + tests.

## Réutilisation
- Résolution formation/peuple : `CharacterSheetReferenceResolver` (back) — déjà là, donne stat+bonus → vigueur totale.
- Armures liées : `SheetReferenceLinkRepository.findItemsBySheet` (back), listes N-N front.
- `ReadCellPublic` (front, CharacterSheetSections.kt:156-170) pour lecture seule.
- Pattern champ spécifique reference (stat/bonus formations/peoples en 0008) → répliquer pour `points_de_protection` armures.
- `statDisplay` (front) calcule déjà vigueur totale (pour cohérence d'affichage stat ; PV vient du back).

## Self-review (couverture)
- niveau 1 / stats 0 / PM 0 → A1 ✓
- PV=10+vigueur totale lecture seule → C1,C2,D1 ✓
- Protection=somme armures lecture seule → B(armure protection),C1,C2,D1 ✓
- armure points de protection (création+stockage) → B1-B4,F ✓
- compétences via formation only, onglet lecture seule → E1,E2 ✓
- PDF montre PV/Protection corrects → C3 ✓
