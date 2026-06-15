# MJ rattache toute fiche (sauf les siennes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au MJ d'une campagne de voir et rattacher **toutes les fiches sauf les siennes** (et seul le MJ rattache/détache), au lieu de ne voir que ses propres fiches.

**Architecture:** Deux dépôts git. **Backend** (Node/TS, clean archi 4 couches, `Result<T,E>`, DAO=SQL pur / Repo=assemblage, DI manuelle dans `main.ts`) porte toute la logique : nouveau use case de listing + nouvelle requête repo + changement d'autorisation sur link/unlink + nouvel endpoint. **Frontend** (Kotlin Compose Desktop, anémique, Koin par feature) ne fait qu'afficher : nouvelle méthode repo/use case + bascule du ViewModel de détail vers le nouvel endpoint.

**Tech Stack:** Backend : TypeScript, Express, MySQL (mysql2), umzug, Vitest + Testcontainers, ESLint custom `ejdr/*`. Frontend : Kotlin 2.2.20, Compose MP, Ktor client, Koin, JUnit5 + MockK + ktor-client-mock, detekt + Kover.

**Spec:** `docs/superpowers/specs/2026-06-14-mj-rattache-toute-fiche-design.md`

**Branche :** `feat/campaigns` (dans les deux repos). Tous les chemins backend sont relatifs à `E-JDR-Backend/`, frontend à `E-JDR-Frontend/`.

---

## Rappels d'environnement (lire avant de commencer)

- **Commits backend** : un hook commitlint impose un sujet en **minuscules** (pas d'acronyme majuscule type « MJ » dans le sujet, mettre « mj »). Conventional Commits (`feat:`, `test:`, `refactor:`, `docs:`).
- **Backend** : `npm test` exclut les tests DB. `npm run test:db` (Testcontainers) **nécessite Docker** — à lancer par l'utilisateur, ne pas tenter en CI locale headless.
- **Frontend** : `./gradlew` est réécrit en `rtk gradlew` par un hook. Lancer **un seul** build, `--console=plain`, **sans** boucle de polling en parallèle (fige le daemon).
- **Frontend Kover** : exclut l'UI Compose mais compte les ViewModels. Le `CampaignDetailViewModel` modifié reste compté — garder ses tests verts.
- **ESLint backend** `ejdr/parameter-count` max 6 : surveiller les constructeurs.

---

## File Structure

**Backend — créés :**
- `src/application/features/character-sheet/query/ListLinkableCharactersQuery.ts` — query (campaignId + actorUserId)
- `src/application/features/character-sheet/abstractions/usecases/ListLinkableCharactersUseCase.ts` — port in
- `src/application/features/character-sheet/usecases/ListLinkableCharactersUseCaseImpl.ts` — use case (autz MJ + listing)
- `tests/application/ListLinkableCharactersUseCase.test.ts` — tests use case

**Backend — modifiés :**
- `src/application/features/character-sheet/abstractions/repositories/CharacterSheetRepository.ts` — + `findLinkableForCampaign`
- `src/infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao.ts` — + requête SQL
- `src/infrastructure/persistence/mysql/features/character-sheet/repository/MysqlCharacterSheetRepository.ts` — + assemblage
- `src/application/features/character-sheet/usecases/LinkCharacterToCampaignUseCaseImpl.ts` — autz → MJ
- `src/application/features/character-sheet/usecases/UnlinkCharacterFromCampaignUseCaseImpl.ts` — autz → MJ seul
- `src/presentation/http/features/campaign/controllers/CampaignCharacterController.ts` — + méthode `listLinkable`
- `src/presentation/http/features/campaign/routes/...campaign routes file` — + route GET linkable-characters
- `src/main.ts` — câblage use case + controller
- `tests/application/fakes.ts` — `FakeCharacterSheetRepository.findLinkableForCampaign`
- `tests/application/LinkCharacterToCampaignUseCase.test.ts` — MAJ autz
- `tests/application/UnlinkCharacterFromCampaignUseCase.test.ts` — MAJ autz
- `tests/db/CharacterSheetDao.test.ts` — + test SQL (Docker, user)
- `docs/CONTRAT_API.md` — + endpoint

**Frontend — modifiés :**
- `.../application/features/charactersheet/abstraction/repository/CharacterSheetRepository.kt` — + `listLinkableForCampaign`
- `.../application/features/charactersheet/abstraction/usecase/CharacterSheetUseCases.kt` — + `ListLinkableCharactersUseCase`
- `.../application/features/charactersheet/usecase/CharacterSheetUseCaseImpls.kt` — + impl
- `.../infrastructure/http/features/charactersheet/CharacterSheetHttpRepository.kt` — + appel HTTP
- `.../di/CharacterSheetModule.kt` — + binding
- `.../presentation/features/campaign/CampaignDetailViewModel.kt` — `listMySheets`→`listLinkable`, renommage `linkableSheets`
- `.../presentation/features/campaign/page/CampaignDetailPage.kt` — passe `linkableSheets`, retire le filtre client
- `.../presentation/features/campaign/component/LinkCharacterDialog.kt` — texte vide
- `src/test/.../campaign/CampaignDetailViewModelTest.kt` — MAJ

---

# PARTIE A — BACKEND

## Task A1 : Query + port du use case `ListLinkableCharacters`

**Files:**
- Create: `src/application/features/character-sheet/query/ListLinkableCharactersQuery.ts`
- Create: `src/application/features/character-sheet/abstractions/usecases/ListLinkableCharactersUseCase.ts`

- [ ] **Step 1 : Créer la query**

`src/application/features/character-sheet/query/ListLinkableCharactersQuery.ts` :
```ts
/**
 * Requête de lecture du use case « lister les fiches rattachables à une campagne ».
 *
 * `actorUserId` provient de la session : il doit être le MJ de la campagne. La liste retournée
 * exclut les fiches du MJ et celles déjà rattachées à la campagne.
 */
export interface ListLinkableCharactersQuery {
  /** Identifiant de la campagne dont on cherche les fiches rattachables. */
  readonly campaignId: string;
  /** Identifiant du demandeur (issu de la session) ; doit être le MJ de la campagne. */
  readonly actorUserId: string;
}
```

- [ ] **Step 2 : Créer le port in**

`src/application/features/character-sheet/abstractions/usecases/ListLinkableCharactersUseCase.ts` :
```ts
import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ListLinkableCharactersQuery } from "@application/features/character-sheet/query/ListLinkableCharactersQuery";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/** Port « in » du use case « lister les fiches rattachables à une campagne ». */
export interface ListLinkableCharactersUseCase {
  execute(query: ListLinkableCharactersQuery): Promise<Result<CharacterSheetSummary[], AppError>>;
}
```

- [ ] **Step 3 : Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (aucune erreur)

- [ ] **Step 4 : Commit**

```bash
git add src/application/features/character-sheet/query/ListLinkableCharactersQuery.ts src/application/features/character-sheet/abstractions/usecases/ListLinkableCharactersUseCase.ts
git commit -m "feat(character-sheet): add port + query for linkable characters listing"
```

---

## Task A2 : Méthode repo `findLinkableForCampaign` (port + fake)

**Files:**
- Modify: `src/application/features/character-sheet/abstractions/repositories/CharacterSheetRepository.ts`
- Modify: `tests/application/fakes.ts` (classe `FakeCharacterSheetRepository`)

- [ ] **Step 1 : Ajouter la méthode au port**

Dans `CharacterSheetRepository.ts`, ajouter cette méthode dans l'interface, après `deleteById` :
```ts
  /**
   * Récupère les fiches rattachables à une campagne : toutes celles dont le propriétaire
   * n'est PAS le maître du jeu, en excluant les fiches déjà rattachées à cette campagne.
   *
   * @param gameMasterId - Identifiant du MJ de la campagne (ses fiches sont exclues).
   * @param campaignId - Identifiant de la campagne (les fiches déjà liées sont exclues).
   * @returns Les fiches rattachables (tableau éventuellement vide).
   */
  findLinkableForCampaign(gameMasterId: string, campaignId: string): Promise<CharacterSheet[]>;
```

- [ ] **Step 2 : Implémenter dans le fake**

Dans `tests/application/fakes.ts`, classe `FakeCharacterSheetRepository`. Le fake n'a pas accès aux liaisons campagne↔fiche directement ; on ajoute un registre de liaisons local + une méthode de seed. Ajouter le champ et les méthodes après `deleteById` :
```ts
  /** Liaisons connues (clé = `${campaignId}:${sheetId}`), pour simuler l'exclusion des déjà liées. */
  private readonly links = new Set<string>();

  /** Aide de test : enregistre une liaison fiche↔campagne (pour `findLinkableForCampaign`). */
  public seedLink(campaignId: string, sheetId: string): void {
    this.links.add(`${campaignId}:${sheetId}`);
  }

  public async findLinkableForCampaign(
    gameMasterId: string,
    campaignId: string,
  ): Promise<CharacterSheet[]> {
    return [...this.sheets.values()].filter(
      (sheet) => !sheet.isOwnedBy(gameMasterId) && !this.links.has(`${campaignId}:${sheet.id}`),
    );
  }
```

- [ ] **Step 3 : Vérifier la compilation (src + tests)**

Run: `npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.json --rootDir . --include 'tests/**/*.ts' || npx vitest run --no-coverage tests/application/fakes.ts 2>/dev/null; echo done`
Expected: pas d'erreur de type sur `fakes.ts` (le fake implémente bien le port). En pratique : `npx tsc --noEmit` doit passer.

- [ ] **Step 4 : Commit**

```bash
git add src/application/features/character-sheet/abstractions/repositories/CharacterSheetRepository.ts tests/application/fakes.ts
git commit -m "feat(character-sheet): add findLinkableForCampaign to repository port and fake"
```

---

## Task A3 : Use case `ListLinkableCharactersUseCaseImpl` (TDD)

**Files:**
- Create: `tests/application/ListLinkableCharactersUseCase.test.ts`
- Create: `src/application/features/character-sheet/usecases/ListLinkableCharactersUseCaseImpl.ts`

- [ ] **Step 1 : Écrire le test (échoue)**

`tests/application/ListLinkableCharactersUseCase.test.ts`. S'inspirer des tests existants pour les helpers (`buildTestCampaign`, `buildTestCharacterSheet`, `FakeCampaignRepository`, `FakeCharacterSheetRepository`). Vérifier d'abord les signatures exactes de ces helpers dans `tests/application/fakes.ts` et les autres tests `tests/application/*CharacterSheet*.test.ts` avant d'écrire (réutiliser leurs patterns d'import).
```ts
import { describe, it, expect } from "vitest";
import { ListLinkableCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListLinkableCharactersUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import {
  FakeCampaignRepository,
  FakeCharacterSheetRepository,
  buildTestCampaign,
  buildTestCharacterSheet,
} from "./fakes";

describe("ListLinkableCharactersUseCaseImpl", () => {
  const GM = "gm-1";
  const PLAYER = "player-1";
  const CAMPAIGN_ID = "camp-1";

  function setup() {
    const campaigns = new FakeCampaignRepository();
    const sheets = new FakeCharacterSheetRepository();
    campaigns.seed(buildTestCampaign({ id: CAMPAIGN_ID, gameMasterId: GM }));
    const useCase = new ListLinkableCharactersUseCaseImpl(campaigns, sheets);
    return { campaigns, sheets, useCase };
  }

  it("échoue si la campagne n'existe pas", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ campaignId: "unknown", actorUserId: GM });
    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("refuse si le demandeur n'est pas le MJ", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ campaignId: CAMPAIGN_ID, actorUserId: PLAYER });
    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("renvoie les fiches des autres comptes, exclut celles du MJ", async () => {
    const { sheets, useCase } = setup();
    sheets.seed(buildTestCharacterSheet({ id: "s-player", ownerId: PLAYER, name: "Aragorn" }));
    sheets.seed(buildTestCharacterSheet({ id: "s-gm", ownerId: GM, name: "Sauron" }));
    const result = await useCase.execute({ campaignId: CAMPAIGN_ID, actorUserId: GM });
    expect(result.isSuccess).toBe(true);
    const ids = result.value.map((s) => s.id);
    expect(ids).toContain("s-player");
    expect(ids).not.toContain("s-gm");
  });

  it("exclut les fiches déjà rattachées à la campagne", async () => {
    const { sheets, useCase } = setup();
    sheets.seed(buildTestCharacterSheet({ id: "s-player", ownerId: PLAYER, name: "Aragorn" }));
    sheets.seedLink(CAMPAIGN_ID, "s-player");
    const result = await useCase.execute({ campaignId: CAMPAIGN_ID, actorUserId: GM });
    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(0);
  });
});
```
> Si les noms de helpers (`buildTestCampaign`, `buildTestCharacterSheet`, `seed`) diffèrent dans `fakes.ts`, adapter les appels à ce qui existe — ne pas inventer de helper.

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npx vitest run tests/application/ListLinkableCharactersUseCase.test.ts`
Expected: FAIL — `Cannot find module '...ListLinkableCharactersUseCaseImpl'`.

- [ ] **Step 3 : Implémenter le use case**

`src/application/features/character-sheet/usecases/ListLinkableCharactersUseCaseImpl.ts` :
```ts
import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { ListLinkableCharactersQuery } from "@application/features/character-sheet/query/ListLinkableCharactersQuery";
import { ListLinkableCharactersUseCase } from "@application/features/character-sheet/abstractions/usecases/ListLinkableCharactersUseCase";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/**
 * Use case « lister les fiches rattachables à une campagne » (lecture pure).
 *
 * Réservé au maître du jeu : il peut rattacher n'importe quelle fiche d'un AUTRE joueur. La liste
 * exclut ses propres fiches (règle MJ≠joueur) et les fiches déjà rattachées à la campagne.
 */
export class ListLinkableCharactersUseCaseImpl implements ListLinkableCharactersUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly characterSheetRepository: CharacterSheetRepository,
  ) {}

  public async execute(
    query: ListLinkableCharactersQuery,
  ): Promise<Result<CharacterSheetSummary[], AppError>> {
    const campaign = await this.campaignRepository.findById(query.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    if (!campaign.isGameMaster(query.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const sheets = await this.characterSheetRepository.findLinkableForCampaign(
      query.actorUserId,
      query.campaignId,
    );

    const summaries: CharacterSheetSummary[] = sheets.map((sheet) => ({
      id: sheet.id,
      ownerId: sheet.ownerId,
      name: sheet.name.value,
      createdAt: sheet.createdAt,
    }));

    return Result.success(summaries);
  }
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npx vitest run tests/application/ListLinkableCharactersUseCase.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add tests/application/ListLinkableCharactersUseCase.test.ts src/application/features/character-sheet/usecases/ListLinkableCharactersUseCaseImpl.ts
git commit -m "feat(character-sheet): add list-linkable-characters use case (gm-only)"
```

---

## Task A4 : Changer l'autorisation du rattachement (TDD)

**Files:**
- Modify: `src/application/features/character-sheet/usecases/LinkCharacterToCampaignUseCaseImpl.ts:46-49`
- Modify: `tests/application/LinkCharacterToCampaignUseCase.test.ts`

- [ ] **Step 1 : Mettre à jour les tests**

Ouvrir `tests/application/LinkCharacterToCampaignUseCase.test.ts`. Localiser le test qui vérifie aujourd'hui « refuse si la fiche n'appartient pas au demandeur » (basé sur `isOwnedBy`). Le **remplacer** par la nouvelle sémantique. Ajouter/ajuster ces cas (adapter aux helpers existants du fichier) :
```ts
  it("refuse si le demandeur n'est pas le MJ de la campagne", async () => {
    // campagne dont le MJ = GM ; demandeur = un autre user
    // attendu : CharacterSheetAccessDeniedError
  });

  it("réussit quand le MJ rattache la fiche d'un autre joueur", async () => {
    // campagne MJ=GM ; fiche owner=PLAYER ; actorUserId=GM
    // attendu : succès, la liaison est créée
  });

  it("refuse 409 si le MJ tente de rattacher SA propre fiche (règle MJ≠joueur)", async () => {
    // campagne MJ=GM ; fiche owner=GM ; actorUserId=GM
    // attendu : GameMasterCannotJoinOwnCampaignError
  });
```
> Remplir le corps de chaque test sur le modèle des cas existants du fichier (mêmes fakes, mêmes builders). Conserver le test du doublon (`SheetAlreadyInCampaignError`).

- [ ] **Step 2 : Lancer les tests (le nouveau cas MJ doit échouer)**

Run: `npx vitest run tests/application/LinkCharacterToCampaignUseCase.test.ts`
Expected: FAIL sur « réussit quand le MJ rattache la fiche d'un autre joueur » (l'impl exige encore `isOwnedBy`).

- [ ] **Step 3 : Modifier le use case**

Dans `LinkCharacterToCampaignUseCaseImpl.ts`, remplacer le bloc actuel (≈ lignes 46-49) :
```ts
    // On ne rattache que SES propres fiches.
    if (!sheet.isOwnedBy(command.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }
```
par :
```ts
    // Seul le MJ de la campagne rattache des fiches (à n'importe quel autre joueur).
    if (!campaign.isGameMaster(command.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }
```
Mettre aussi à jour la JSDoc de la classe (règle n°2 : « le demandeur doit être le **MJ de la campagne** » au lieu de « propriétaire de la fiche »). La règle MJ≠joueur juste en dessous (`campaign.isGameMaster(sheet.ownerId)` ⇒ `GameMasterCannotJoinOwnCampaignError`) reste **inchangée**.

- [ ] **Step 4 : Lancer les tests (doivent passer)**

Run: `npx vitest run tests/application/LinkCharacterToCampaignUseCase.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/application/features/character-sheet/usecases/LinkCharacterToCampaignUseCaseImpl.ts tests/application/LinkCharacterToCampaignUseCase.test.ts
git commit -m "feat(character-sheet): only the gm can link characters to their campaign"
```

---

## Task A5 : Changer l'autorisation du détachement (TDD)

**Files:**
- Modify: `src/application/features/character-sheet/usecases/UnlinkCharacterFromCampaignUseCaseImpl.ts`
- Modify: `tests/application/UnlinkCharacterFromCampaignUseCase.test.ts`

- [ ] **Step 1 : Mettre à jour les tests**

Dans `tests/application/UnlinkCharacterFromCampaignUseCase.test.ts`, le test « le propriétaire de la fiche peut détacher » doit désormais attendre un **échec 403**. Ajuster :
```ts
  it("réussit quand le MJ détache une fiche", async () => {
    // actorUserId = MJ → succès
  });

  it("refuse 403 quand le propriétaire (non-MJ) tente de détacher", async () => {
    // campagne MJ=GM ; fiche owner=PLAYER ; actorUserId=PLAYER
    // attendu : CharacterSheetAccessDeniedError
  });

  it("refuse 403 pour un tiers", async () => {
    // actorUserId = autre → CharacterSheetAccessDeniedError
  });
```
> Remplir sur le modèle des cas existants.

- [ ] **Step 2 : Lancer les tests (le cas propriétaire doit échouer)**

Run: `npx vitest run tests/application/UnlinkCharacterFromCampaignUseCase.test.ts`
Expected: FAIL — aujourd'hui le propriétaire est autorisé, le test « refuse 403 » échoue.

- [ ] **Step 3 : Modifier le use case**

Dans `UnlinkCharacterFromCampaignUseCaseImpl.ts`, remplacer le bloc d'autorisation actuel :
```ts
    const isAuthorized =
      campaign.isGameMaster(command.actorUserId) || sheet.isOwnedBy(command.actorUserId);
    if (!isAuthorized) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }
```
par :
```ts
    // Seul le MJ de la campagne gère la composition de sa table (rattache et détache).
    if (!campaign.isGameMaster(command.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }
```
Mettre à jour la JSDoc de la classe : « Autorisation : le détachement est permis **au seul maître du jeu** de la campagne. »

> Note : `sheet` reste chargé pour la vérification d'existence (404) — ne pas le supprimer.

- [ ] **Step 4 : Lancer les tests (doivent passer)**

Run: `npx vitest run tests/application/UnlinkCharacterFromCampaignUseCase.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/application/features/character-sheet/usecases/UnlinkCharacterFromCampaignUseCaseImpl.ts tests/application/UnlinkCharacterFromCampaignUseCase.test.ts
git commit -m "feat(character-sheet): only the gm can unlink characters from their campaign"
```

---

## Task A6 : Implémentation SQL `findLinkableForCampaign` (DAO + repo)

**Files:**
- Modify: `src/infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao.ts`
- Modify: `src/infrastructure/persistence/mysql/features/character-sheet/repository/MysqlCharacterSheetRepository.ts`
- Modify: `tests/db/CharacterSheetDao.test.ts` (Docker — exécuté par l'utilisateur)

- [ ] **Step 1 : Ajouter la requête au DAO**

Dans `CharacterSheetDao.ts`, ajouter cette méthode après `findByOwnerId` :
```ts
  /**
   * Récupère les fiches rattachables à une campagne : propriétaire ≠ MJ, hors fiches déjà
   * liées à cette campagne. Triées des plus récentes aux plus anciennes.
   *
   * @param gameMasterId - L'identifiant du MJ (ses fiches sont exclues).
   * @param campaignId - L'identifiant de la campagne (les fiches déjà liées sont exclues).
   * @returns Les lignes correspondantes (tableau éventuellement vide).
   */
  public async findLinkableForCampaign(
    gameMasterId: string,
    campaignId: string,
  ): Promise<CharacterSheetRow[]> {
    const [rows] = await this.executor.execute<CharacterSheetRow[]>(
      `SELECT cs.id, cs.owner_id, cs.name, cs.created_at
         FROM character_sheets cs
        WHERE cs.owner_id <> ?
          AND NOT EXISTS (
            SELECT 1 FROM campaign_characters cc
             WHERE cc.character_sheet_id = cs.id AND cc.campaign_id = ?
          )
        ORDER BY cs.created_at DESC`,
      [gameMasterId, campaignId],
    );
    return rows;
  }
```

- [ ] **Step 2 : Assembler dans le repository**

Dans `MysqlCharacterSheetRepository.ts`, ajouter après `findByOwnerId` :
```ts
  public async findLinkableForCampaign(
    gameMasterId: string,
    campaignId: string,
  ): Promise<CharacterSheet[]> {
    const rows = await this.characterSheetDao.findLinkableForCampaign(gameMasterId, campaignId);
    return rows.map((row) => CharacterSheetMapper.toDomain(row));
  }
```

- [ ] **Step 3 : Ajouter le test DAO Testcontainers**

Dans `tests/db/CharacterSheetDao.test.ts`, ajouter un test (suivre le style des tests DAO existants du fichier : insertion via le DAO, assertions sur le retour). Cas : deux fiches (une owner=GM, une owner=PLAYER), une liaison insérée pour une 3e ; `findLinkableForCampaign(GM, campaignId)` renvoie uniquement la fiche du PLAYER non liée. Réutiliser les helpers d'insertion campagne/liaison déjà présents dans les tests DB (`CampaignDao`, `CampaignCharacterDao`).

- [ ] **Step 4 : Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5 : Commit** (le test DB sera lancé par l'utilisateur)

```bash
git add src/infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao.ts src/infrastructure/persistence/mysql/features/character-sheet/repository/MysqlCharacterSheetRepository.ts tests/db/CharacterSheetDao.test.ts
git commit -m "feat(character-sheet): SQL query for linkable characters (excludes gm + linked)"
```

> ⚠️ **Action utilisateur** : `npm run test:db` (Docker requis) pour valider ce SQL + l'idempotence des migrations.

---

## Task A7 : Endpoint HTTP + câblage `main.ts`

**Files:**
- Modify: `src/presentation/http/features/campaign/controllers/CampaignCharacterController.ts`
- Modify: `src/presentation/http/features/campaign/routes/<campaign routes file>.ts`
- Modify: `src/main.ts` (fonction `buildCampaignCharacterController`)

- [ ] **Step 1 : Ajouter le use case au controller**

Dans `CampaignCharacterController.ts` :
1. Importer le port :
```ts
import { ListLinkableCharactersUseCase } from "@application/features/character-sheet/abstractions/usecases/ListLinkableCharactersUseCase";
```
2. Ajouter le paramètre au constructeur (passe à **4** params — sous la limite ESLint de 6) :
```ts
  constructor(
    private readonly linkCharacter: LinkCharacterToCampaignUseCase,
    private readonly unlinkCharacter: UnlinkCharacterFromCampaignUseCase,
    private readonly listCampaignCharacters: ListCampaignCharactersUseCase,
    private readonly listLinkableCharacters: ListLinkableCharactersUseCase,
  ) {}
```
3. Ajouter la méthode (calquée sur `list`, réponse `{ characters }`) après `list` :
```ts
  /** `GET /campaigns/:campaignId/linkable-characters` — fiches rattachables (MJ uniquement). */
  public listLinkable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listLinkableCharacters.execute({
        campaignId: req.params.campaignId ?? "",
        actorUserId: req.user!.userId,
      });

      if (result.isFailure) {
        res
          .status(CharacterSheetHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }

      const characters = result.value.map((sheet) => ({
        id: sheet.id,
        ownerId: sheet.ownerId,
        name: sheet.name,
        createdAt: sheet.createdAt.toISOString(),
      }));
      res.status(200).json({ characters });
    } catch (error) {
      next(error);
    }
  };
```
> Note : `result.value` ici est un `CharacterSheetSummary[]`, donc `sheet.name` est déjà une `string` et `sheet.createdAt` une `Date` (cf. la méthode `list` existante qui fait exactement ce mapping).

- [ ] **Step 2 : Ajouter la route**

Dans le fichier des routes campaign (celui qui contient `buildCampaignRoutes`), ajouter, dans la section « Liaison campagne↔fiches », **avant** la route paramétrée `/:campaignId/characters` n'est pas nécessaire (chemins distincts), mais placer la ligne près des autres :
```ts
  router.get("/:campaignId/linkable-characters", characterController.listLinkable);
```

- [ ] **Step 3 : Câbler dans main.ts**

Dans `src/main.ts`, fonction `buildCampaignCharacterController` :
1. Importer le use case impl en haut du fichier (près des autres imports character-sheet) :
```ts
import { ListLinkableCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListLinkableCharactersUseCaseImpl";
```
2. Instancier et passer au controller :
```ts
  const listLinkableCharacters = new ListLinkableCharactersUseCaseImpl(
    services.campaignRepository,
    services.characterSheetRepository,
  );

  return new CampaignCharacterController(
    linkCharacter,
    unlinkCharacter,
    listCampaignCharacters,
    listLinkableCharacters,
  );
```

- [ ] **Step 4 : Vérifier compilation + lint + format**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint && npm run format:check`
Expected: PASS partout (0 erreur ESLint, formatage OK).

- [ ] **Step 5 : Lancer toute la suite (hors DB)**

Run: `npm test`
Expected: PASS — tous les tests verts, y compris les nouveaux et les MAJ.

- [ ] **Step 6 : Commit**

```bash
git add src/presentation/http/features/campaign/controllers/CampaignCharacterController.ts src/presentation/http/features/campaign/routes/ src/main.ts
git commit -m "feat(campaign): expose GET /campaigns/:id/linkable-characters (gm-only)"
```

---

## Task A8 : Documenter l'endpoint + changements d'autz

**Files:**
- Modify: `docs/CONTRAT_API.md`

- [ ] **Step 1 : Ajouter l'endpoint et corriger les autz**

Dans `docs/CONTRAT_API.md`, section campagne/liaison :
1. Ajouter `GET /campaigns/:campaignId/linkable-characters` — réservé au MJ — `200 { characters: [...] }` ; erreurs : `404 CAMPAIGN_NOT_FOUND`, `403 CHARACTER_SHEET_ACCESS_DENIED` (= pas le MJ).
2. Mettre à jour `POST /campaigns/:campaignId/characters` : autorisé au **MJ** ; `403 CHARACTER_SHEET_ACCESS_DENIED` = pas le MJ ; `409 GM_CANNOT_JOIN_OWN_CAMPAIGN` conservé.
3. Mettre à jour `DELETE …/:characterSheetId` : autorisé au **MJ seul**.

- [ ] **Step 2 : Commit**

```bash
git add docs/CONTRAT_API.md
git commit -m "docs(api): document linkable-characters endpoint and gm-only link/unlink"
```

---

# PARTIE B — FRONTEND

## Task B1 : Port repo + use case `listLinkableForCampaign`

**Files:**
- Modify: `src/main/kotlin/eu/ejdr/application/features/charactersheet/abstraction/repository/CharacterSheetRepository.kt`
- Modify: `src/main/kotlin/eu/ejdr/application/features/charactersheet/abstraction/usecase/CharacterSheetUseCases.kt`
- Modify: `src/main/kotlin/eu/ejdr/application/features/charactersheet/usecase/CharacterSheetUseCaseImpls.kt`

- [ ] **Step 1 : Ajouter la méthode au port**

Dans `CharacterSheetRepository.kt`, ajouter après `listForCampaign` :
```kotlin
    /** Liste les fiches rattachables à une campagne (toutes sauf celles du MJ, hors déjà liées). */
    suspend fun listLinkableForCampaign(
        campaignId: String,
    ): Result<List<CharacterSheet>, CharacterSheetError>
```

- [ ] **Step 2 : Ajouter le use case (port)**

Dans `CharacterSheetUseCases.kt`, ajouter après `ListCampaignCharactersUseCase` :
```kotlin
/** Use case : liste les fiches rattachables à une campagne (MJ uniquement, côté back). */
fun interface ListLinkableCharactersUseCase {
    suspend operator fun invoke(
        campaignId: String,
    ): Result<List<CharacterSheet>, CharacterSheetError>
}
```

- [ ] **Step 3 : Ajouter l'impl**

Dans `CharacterSheetUseCaseImpls.kt`, ajouter l'import :
```kotlin
import eu.ejdr.application.features.charactersheet.abstraction.usecase.ListLinkableCharactersUseCase
```
et la classe (après `ListCampaignCharactersUseCaseImpl`) :
```kotlin
class ListLinkableCharactersUseCaseImpl(
    private val repository: CharacterSheetRepository,
) : ListLinkableCharactersUseCase {
    override suspend fun invoke(
        campaignId: String,
    ): Result<List<CharacterSheet>, CharacterSheetError> =
        repository.listLinkableForCampaign(campaignId)
}
```

- [ ] **Step 4 : Commit** (ne compile pas encore seul — l'impl HTTP du port manque ; commit groupé avec B2)

Passer directement à B2 avant de compiler.

---

## Task B2 : Impl HTTP + binding Koin

**Files:**
- Modify: `src/main/kotlin/eu/ejdr/infrastructure/http/features/charactersheet/CharacterSheetHttpRepository.kt`
- Modify: `src/main/kotlin/eu/ejdr/di/CharacterSheetModule.kt`

- [ ] **Step 1 : Implémenter l'appel HTTP**

Dans `CharacterSheetHttpRepository.kt`, ajouter après `listForCampaign` (réutilise `CampaignCharactersResponseDto` — même forme `{ characters: [...] }`) :
```kotlin
    override suspend fun listLinkableForCampaign(
        campaignId: String,
    ): Result<List<CharacterSheet>, CharacterSheetError> =
        runCatchingCancellable {
            val response =
                client.get("${config.baseUrl}/campaigns/$campaignId/linkable-characters")
            if (response.status.isSuccess()) {
                val body = response.body<CampaignCharactersResponseDto>()
                Result.Success(body.characters.map(CharacterSheetHttpMapper::toCharacterSheet))
            } else {
                failure(response)
            }
        }.getOrElse { Result.Failure(CharacterSheetError.Network) }
```

- [ ] **Step 2 : Ajouter le binding Koin**

Dans `CharacterSheetModule.kt` :
1. Ajouter les imports :
```kotlin
import eu.ejdr.application.features.charactersheet.abstraction.usecase.ListLinkableCharactersUseCase
import eu.ejdr.application.features.charactersheet.usecase.ListLinkableCharactersUseCaseImpl
```
2. Ajouter le binding dans le `module { ... }` (après `ListCampaignCharactersUseCase`) :
```kotlin
    single<ListLinkableCharactersUseCase> { ListLinkableCharactersUseCaseImpl(get()) }
```

- [ ] **Step 3 : Compiler**

Run: `./gradlew compileKotlin --console=plain`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4 : Commit** (B1 + B2 ensemble)

```bash
git add src/main/kotlin/eu/ejdr/application/features/charactersheet/ src/main/kotlin/eu/ejdr/infrastructure/http/features/charactersheet/CharacterSheetHttpRepository.kt src/main/kotlin/eu/ejdr/di/CharacterSheetModule.kt
git commit -m "feat(charactersheet): add listLinkableForCampaign repo + use case + binding"
```

---

## Task B3 : Bascule du ViewModel de détail (TDD)

**Files:**
- Modify: `src/main/kotlin/eu/ejdr/presentation/features/campaign/CampaignDetailViewModel.kt`
- Modify: `src/test/kotlin/eu/ejdr/presentation/features/campaign/CampaignDetailViewModelTest.kt`

- [ ] **Step 1 : Mettre à jour le test**

Ouvrir `CampaignDetailViewModelTest.kt`. Remplacer le stub/mock de `ListCharacterSheetsUseCase` (alias `listMySheets`) par `ListLinkableCharactersUseCase` prenant `campaignId`. Renommer les assertions `mySheets` → `linkableSheets`. Vérifier : au `load()`, `linkableSheets` reçoit ce que renvoie `listLinkableCharacters(campaignId)`, et est rechargé après `link`/`unlink`. Suivre la structure MockK existante du fichier (mêmes `coEvery`/`coVerify`).

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `./gradlew test --tests "*CampaignDetailViewModelTest" --console=plain`
Expected: FAIL (compile error — le VM expose encore `mySheets`/`listMySheets`).

- [ ] **Step 3 : Modifier le ViewModel**

Dans `CampaignDetailViewModel.kt` :
1. Remplacer l'import :
```kotlin
import eu.ejdr.application.features.charactersheet.abstraction.usecase.ListCharacterSheetsUseCase
```
par :
```kotlin
import eu.ejdr.application.features.charactersheet.abstraction.usecase.ListLinkableCharactersUseCase
```
2. Remplacer le paramètre du constructeur :
```kotlin
    private val listMySheets: ListCharacterSheetsUseCase,
```
par :
```kotlin
    private val listLinkable: ListLinkableCharactersUseCase,
```
3. Renommer l'état :
```kotlin
    private val _linkableSheets = MutableStateFlow<List<CharacterSheet>>(emptyList())
    val linkableSheets: StateFlow<List<CharacterSheet>> = _linkableSheets.asStateFlow()
```
(supprimer `_mySheets`/`mySheets`).
4. Dans `load()`, remplacer le second bloc :
```kotlin
            listLinkable(campaignId).fold(
                onSuccess = { _linkableSheets.value = it },
                onFailure = { _error.value = it.message },
            )
```
Mettre à jour la KDoc de la classe (`mySheets` → `linkableSheets`, « fiches rattachables » au lieu de « mes fiches »).

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `./gradlew test --tests "*CampaignDetailViewModelTest" --console=plain`
Expected: BUILD SUCCESSFUL (tests verts).

- [ ] **Step 5 : Commit**

```bash
git add src/main/kotlin/eu/ejdr/presentation/features/campaign/CampaignDetailViewModel.kt src/test/kotlin/eu/ejdr/presentation/features/campaign/CampaignDetailViewModelTest.kt
git commit -m "feat(campaign): detail VM lists linkable characters instead of my own"
```

---

## Task B4 : Page détail + dialog (UI)

**Files:**
- Modify: `src/main/kotlin/eu/ejdr/presentation/features/campaign/page/CampaignDetailPage.kt`
- Modify: `src/main/kotlin/eu/ejdr/presentation/features/campaign/component/LinkCharacterDialog.kt`

- [ ] **Step 1 : Mettre à jour la page**

Dans `CampaignDetailPage.kt` :
1. Remplacer l'import `ListCharacterSheetsUseCase` par `ListLinkableCharactersUseCase`.
2. Dans le `koinViewModel { CampaignDetailViewModel(...) }`, remplacer :
```kotlin
            listMySheets = get<ListCharacterSheetsUseCase>(),
```
par :
```kotlin
            listLinkable = get<ListLinkableCharactersUseCase>(),
```
3. Remplacer la collecte d'état :
```kotlin
    val mySheets by viewModel.mySheets.collectAsStateWithLifecycle()
```
par :
```kotlin
    val linkableSheets by viewModel.linkableSheets.collectAsStateWithLifecycle()
```
4. Dans le bloc `if (showLink)`, **retirer le filtre client devenu redondant** (le back exclut déjà les fiches liées) :
```kotlin
    if (showLink) {
        LinkCharacterDialog(
            sheets = linkableSheets,
            onSelect = { sheetId ->
                showLink = false
                viewModel.link(sheetId)
            },
            onDismiss = { showLink = false },
        )
    }
```
(supprimer la ligne `val linkedIds = ...` et le `.filterNot { ... }`). Mettre à jour la KDoc de la page (« rattacher une fiche d'un autre joueur » au lieu de « une de ses propres fiches »).

- [ ] **Step 2 : Ajuster le texte vide du dialog**

Dans `LinkCharacterDialog.kt`, remplacer :
```kotlin
                    "Aucune fiche disponible. Créez-en une dans « Mes fiches ».",
```
par :
```kotlin
                    "Aucune fiche rattachable pour le moment.",
```
Mettre à jour la KDoc du paramètre `sheets` : « Fiches rattachables renvoyées par le back (autres joueurs, non déjà liées). »

- [ ] **Step 3 : Compiler**

Run: `./gradlew compileKotlin --console=plain`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4 : Commit**

```bash
git add src/main/kotlin/eu/ejdr/presentation/features/campaign/page/CampaignDetailPage.kt src/main/kotlin/eu/ejdr/presentation/features/campaign/component/LinkCharacterDialog.kt
git commit -m "feat(campaign): detail page shows linkable characters, drop client-side filter"
```

---

## Task B5 : Vérification front complète

- [ ] **Step 1 : `verify` (detekt + tests + Kover)**

Run: `./gradlew verify --console=plain`
Expected: BUILD SUCCESSFUL, 0 warning detekt, Kover ≥ 60%.
> Si Kover descend sous 60% à cause d'un nouveau fichier UI, vérifier que seuls des fichiers logique (VM/use case/repo) sont comptés ; les nouveaux `*.page`/`*.component` doivent rester exclus (ils le sont déjà par convention de package, rien à ajouter ici car aucun nouveau package UI n'est créé).

- [ ] **Step 2 : Pas de commit** (vérification seule).

---

# PARTIE C — VALIDATION FINALE (utilisateur)

Ces étapes ne sont pas automatisables ici (Docker / GUI). À exécuter par l'utilisateur.

- [ ] **C1 — Tests DB backend** : `cd E-JDR-Backend && npm run test:db` (Docker requis). Valide le SQL `findLinkableForCampaign` + l'idempotence des migrations.
- [ ] **C2 — Runtime front** : `cd E-JDR-Frontend && EJDR_API_URL=http://localhost:3000 EJDR_HTTP_LOG=true ./gradlew run --console=plain` (backend up). Parcours :
  1. 2 comptes : compte A crée une campagne ; compte B crée une fiche.
  2. Compte A (MJ) ouvre sa campagne → « Rattacher une fiche » → **la fiche du compte B apparaît** → rattacher → elle passe en « rattachées ».
  3. Vérifier qu'une fiche du compte A (le MJ) **n'apparaît pas** dans le dialog.
  4. Détacher la fiche (en tant que MJ) → elle disparaît des rattachées et redevient rattachable.

---

## Notes de self-review (à supprimer après lecture)

- **Couverture spec** : listing rattachable (A1-A3, A6, A7, B1-B4) ✔ ; autz link = MJ (A4) ✔ ; autz unlink = MJ (A5) ✔ ; endpoint dédié (A7) ✔ ; MJ≠joueur conservé (A4 step 3) ✔ ; front affiche brut + renommage (B3-B4) ✔ ; doc (A8) ✔ ; tests back+front (A3-A6, B3) ✔ ; validations Docker/GUI déléguées (C) ✔.
- **Cohérence de noms** : back `findLinkableForCampaign(gameMasterId, campaignId)` partout ; front port `listLinkableForCampaign(campaignId)`, use case `ListLinkableCharactersUseCase`, VM état `linkableSheets`, param VM `listLinkable`. Cohérents entre tâches.
- **Découverte intégrée** : le front filtrait côté page (`filterNot linkedIds`) — supprimé en B4 car le back exclut déjà les liées (source de vérité unique).
