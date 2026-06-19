# Formations/Peuples enrichis (stat + bonus + compétences) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou superpowers:executing-plans. Steps en checkbox (`- [ ]`).

**Goal:** Donner aux formations et peuples un bonus de statistique (stat ciblée + montant, défaut 1), lier les formations à plusieurs compétences du catalogue, et afficher sur la fiche `base + bonus + total` par stat + les compétences dérivées de la formation.

**Architecture:**
- Back : `formations`/`peoples` quittent les `referenceColumns` génériques et gagnent `stat` (varchar nullable) + `bonus` (int nullable, défaut 1 à la création). Nouvelle table `formation_competences` (formation N-N compétences). Le `GET /character-sheets/:id` renvoie en plus les blocs résolus `formation` et `peuple` (`{ id, name, stat, bonus, competences[] }`) pour que le front affiche les bonus.
- Front : entités/DTO reference enrichis ; dialog de création formation/peuple gagne un sélecteur de stat + montant (+ picker compétences pour formation) ; l'écran fiche calcule `base + bonusPeuple + bonusFormation = total` à l'affichage et liste les compétences de la formation en lecture seule.
- Bonus calculés à l'affichage (jamais stockés dans les stats de la fiche). Compétences de formation **dérivées** (pas copiées en base).

**Tech Stack:** Back Node/TS, Express, Drizzle/MySQL, Vitest. Front Kotlin/Compose, Ktor, Koin, JUnit5.

## Global Constraints

- Stats valides (valeur de `stat`) : `dexterite | intelligence | perception | social | vigueur` (mêmes noms que les colonnes fiche). `null` = pas de bonus.
- `bonus` : entier, défaut **1** à la création si stat choisie ; `null` si pas de stat.
- Cardinalité fiche inchangée : **1 formation + 1 peuple** (N-1, colonnes existantes `formation_id`/`peuple_id`).
- Une source (peuple OU formation) cible **au plus une** stat ; cumul possible sur la même stat (affichage `Social 2 +1 +1 = 4`).
- Compétences de formation **dérivées** (lecture seule sur la fiche, badge « via <formation> ») ; les compétences manuelles N-N (`sheet_competences`) restent inchangées.
- Migrations Drizzle **forward-only**, 2 temps si drop+add (cf. mémoire drizzle-refactor). Prochaine migration = `0008`.
- Hooks husky/prettier/commitlint actifs : `prettier --write` avant commit, messages conventionnels.
- Architecture clean stricte respectée des deux côtés (Result, DAO/Mapper/Repo, use cases, DI manuelle/Koin).

---

## File Structure (back)

- `src/infrastructure/persistence/drizzle/schema/reference.schema.ts` — `formations`/`peoples` : colonnes propres (referenceColumns + `stat`,`bonus`) ; ajout table `formationCompetences`.
- `migrations/0008_*.sql` — ALTER formations/peoples ADD stat,bonus ; CREATE formation_competences.
- `src/domain/features/reference/entities/ReferenceItem.ts` — reste générique (inchangé) ; le bonus n'entre PAS dans l'entité générique.
- Nouveau : `src/domain/features/reference/value-objects/StatBonus.ts` — VO `{ stat, amount }`, validation.
- `src/application/features/reference/abstractions/...` — commandes create formation/peuple enrichies + ports.
- `src/application/features/reference/usecases/...` — création formation (stat+bonus+competenceIds), peuple (stat+bonus).
- `src/infrastructure/persistence/mysql/features/reference/...` — DAO formations/peoples étendus + DAO `formation_competences`.
- `src/presentation/http/features/reference/...` — payload create + réponses incluent stat/bonus/competences.
- `src/application/features/character-sheet/...` + `GetCharacterSheetUseCaseImpl` — résoudre blocs `formation`/`peuple` (stat,bonus,competences) dans le détail fiche.
- `src/presentation/http/features/character-sheet/...` — DTO réponse fiche enrichi.

## File Structure (front)

- `domain/features/reference/entities/ReferenceItem.kt` — + `stat: String?`, `bonus: Int?`, `competenceIds: List<String>` (tolérant, défauts).
- `infrastructure/http/features/reference/dto/ReferenceDtos.kt` — DTO enrichis (tolérants) + payload create.
- `presentation/features/reference/component/ReferenceComponents.kt` — `CreateReferenceDialog` : sélecteur stat + montant + (formation) picker compétences.
- `presentation/features/reference/ReferenceListViewModel.kt` — `create` enrichi.
- `domain/features/charactersheet/...` — bloc `ResolvedReference { id,name,stat,bonus,competences[] }` dans la fiche.
- `presentation/features/charactersheet/component/CharacterSheetSections.kt` — `NumberCell` stats affiche base + bonus + total ; section compétences de formation (lecture seule).

---

## Découpage en tâches

> NB: le détail TDD pas-à-pas de chaque tâche est rédigé au moment de l'exécution (subagent par tâche), en suivant les conventions repérées. Ci-dessous le séquencement et le contrat de chaque tâche (interfaces produites/consommées), suffisant pour exécuter en sous-agents.

### Phase A — Back: schéma & migration
- **A1** Schéma Drizzle : `formations`/`peoples` colonnes propres + `stat varchar(20) null`, `bonus int null` ; table `formation_competences(formation_id, competence_id, created_at)` PK composite, FK cascade, index. Produit: tables à jour.
- **A2** Migration `0008` générée + relue à la main (forward-only) ; `db:reset` + `db:migrate` verts sur MySQL.

### Phase B — Back: domaine & application reference
- **B1** VO `StatBonus.create({stat, amount})` : stat ∈ liste autorisée, amount entier ≥1 défaut 1 ; erreurs domaine. Test.
- **B2** Commande create formation `{groupId, actorId, name, stat?, bonus?, competenceIds[]}` + use case : valide stat/bonus via StatBonus, vérifie compétences existent dans le groupe, persiste formation + lignes formation_competences (transaction). Test.
- **B3** Commande create peuple `{groupId, actorId, name, stat?, bonus?}` + use case. Test.
- **B4** List formations/peuples renvoie `stat, bonus, competenceIds` (vue enrichie). Test.

### Phase C — Back: persistance reference
- **C1** DAO formations/peoples : insert/find avec stat,bonus. DAO `formation_competences` : insert(formationId, competenceId), findByFormation, deleteByFormation. Mappers. Test DB (si Docker) sinon test repo via fakes.
- **C2** Repos + factory `createReferenceRepositories` mis à jour ; DI `main.ts`.

### Phase D — Back: HTTP reference
- **D1** Payload `POST /reference/formations` accepte `{name, groupId, stat?, bonus?, competenceIds?[]}` ; `POST /reference/peoples` accepte `{name, groupId, stat?, bonus?}`. Réponses create+list incluent `stat, bonus, competenceIds`. Tests d'intégration.

### Phase E — Back: fiche enrichie
- **E1** `GetCharacterSheetUseCase` résout, si `formationId`/`peupleId` non-null, les blocs `formation: {id,name,stat,bonus,competences:[{id,name}]}` et `peuple: {id,name,stat,bonus}` (lecture, join). Détail fiche + mapper HTTP enrichis. Tests (fakes + intégration). Stats de base inchangées.

### Phase F — Front: reference
- **F1** Entité + DTO reference enrichis (tolérants). Mapper. Test mapper.
- **F2** `CreateReferenceDialog` : si type=formation/peuple, afficher sélecteur stat (dont « aucune ») + champ montant (défaut 1) ; si formation, picker multi-compétences (catalogue du groupe). `ReferenceListViewModel.create` enrichi. Tests ViewModel.

### Phase G — Front: fiche
- **G1** Modèle fiche front : blocs `formation`/`peuple` résolus (stat,bonus,competences). DTO + mapper. Test.
- **G2** `NumberCell` (ou nouveau composant) : affiche `base (+bonusPeuple)(+bonusFormation) = total` quand des bonus ciblent cette stat ; sinon comportement actuel. Calcul d'affichage pur (base éditable inchangée). Test de la fonction de calcul.
- **G3** Section compétences : afficher les compétences dérivées de la formation en lecture seule (badge « via <formation> »), en plus du picker N-N manuel existant. Test ViewModel/UI léger.

### Phase H — Vérif & runtime
- **H1** Back `npm test` + lint verts ; Front `gradlew verify` vert.
- **H2** Relancer back+front, test runtime 2 clients : créer formation (stat+compétences), peuple (stat), les poser sur une fiche, vérifier `Social 2 +1 +1 = 4` et les compétences dérivées.
- **H3** Commit + push (back + front) sur une branche dédiée `feat/formation-peuple-bonus`.

---

## Self-Review (couverture spec)
- Bonus stat formation+peuple, montant configurable défaut 1 → B1,B2,B3,D1,E1,G2 ✓
- Formation N-N compétences (catalogue existant) → A1,B2,C1,D1,F2 ✓
- Fiche : ajout formation ⇒ bonus + compétences dérivées ; peuple ⇒ bonus → E1,G2,G3 ✓
- Retrait/changement formation ⇒ compétences suivent (dérivées) → E1 (calcul), G3 (affichage) ✓
- Affichage base + bonus + total → G2 ✓
- Cardinalité 1 formation + 1 peuple conservée → aucune migration des colonnes fiche ✓
