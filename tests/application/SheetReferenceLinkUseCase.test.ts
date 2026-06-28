import { describe, it, expect, beforeEach } from "vitest";
import {
  LinkSheetReferenceUseCaseImpl,
  ListSheetReferencesUseCaseImpl,
  UnlinkSheetReferenceUseCaseImpl,
} from "@application/features/reference/usecases/SheetReferenceLinkUseCaseImpls";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { ReferenceItemNotFoundError } from "@application/features/reference/errors/ReferenceItemNotFoundError";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCharacterSheet,
  buildTestReferenceItem,
  buildTestMembership,
} from "./fakes";

describe("Sheet reference link use cases (génériques, testés sur `armes`)", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let groupAccessService: GroupAccessServiceImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.characterSheets,
    );
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "u-1" }));
  });

  function linkUseCase(): LinkSheetReferenceUseCaseImpl {
    return new LinkSheetReferenceUseCaseImpl({
      characterSheetRepository: txRepos.characterSheets,
      itemRepository: txRepos.armes,
      linkRepository: txRepos.sheetArmes,
      selectLinkRepo: (repos) => repos.sheetArmes,
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
    });
  }

  it("rattache un élément possédé à une fiche possédée", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "u-1"));
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));

    const result = await linkUseCase().execute({
      sheetId: "s-1",
      itemId: "a-1",
      actorUserId: "u-1",
    });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.sheetArmes.existsBySheetAndItem("s-1", "a-1")).toBe(true);
  });

  it("est idempotent : re-rattacher ne crée pas de doublon ni d'erreur", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "u-1"));
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));
    await linkUseCase().execute({ sheetId: "s-1", itemId: "a-1", actorUserId: "u-1" });

    const again = await linkUseCase().execute({
      sheetId: "s-1",
      itemId: "a-1",
      actorUserId: "u-1",
    });

    expect(again.isSuccess).toBe(true);
  });

  it("échoue (404) si la fiche n'existe pas", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));
    const result = await linkUseCase().execute({
      sheetId: "ghost",
      itemId: "a-1",
      actorUserId: "u-1",
    });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("échoue (403) si la fiche appartient à un autre utilisateur", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "autre"));
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));
    const result = await linkUseCase().execute({
      sheetId: "s-1",
      itemId: "a-1",
      actorUserId: "u-1",
    });
    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("échoue (404) si l'élément n'existe pas ou appartient à autrui", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "u-1"));
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-autre", "Épée"));
    const result = await linkUseCase().execute({
      sheetId: "s-1",
      itemId: "a-1",
      actorUserId: "u-1",
    });
    expect(result.error).toBeInstanceOf(ReferenceItemNotFoundError);
  });

  it("liste les éléments rattachés à une fiche possédée", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "u-1"));
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));
    txRepos.armes.seed(buildTestReferenceItem("a-2", "group-1", "Hache"));
    await linkUseCase().execute({ sheetId: "s-1", itemId: "a-1", actorUserId: "u-1" });
    await linkUseCase().execute({ sheetId: "s-1", itemId: "a-2", actorUserId: "u-1" });

    const result = await new ListSheetReferencesUseCaseImpl(
      txRepos.characterSheets,
      txRepos.sheetArmes,
    ).execute({ sheetId: "s-1", actorUserId: "u-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.map((i) => i.name).sort()).toEqual(["Hache", "Épée"]);
  });

  it("détache un élément (idempotent), fiche possédée", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "u-1"));
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));
    await linkUseCase().execute({ sheetId: "s-1", itemId: "a-1", actorUserId: "u-1" });

    const useCase = new UnlinkSheetReferenceUseCaseImpl(
      txRepos.characterSheets,
      (repos) => repos.sheetArmes,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
    const result = await useCase.execute({ sheetId: "s-1", itemId: "a-1", actorUserId: "u-1" });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.sheetArmes.existsBySheetAndItem("s-1", "a-1")).toBe(false);
  });
});
