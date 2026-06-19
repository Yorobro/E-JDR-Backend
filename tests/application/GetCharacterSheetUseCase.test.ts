import { describe, it, expect, beforeEach } from "vitest";
import { GetCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/GetCharacterSheetUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import {
  FakeLogger,
  buildFakeTransactionalRepositories,
  buildTestCharacterSheet,
  buildTestMembership,
} from "./fakes";

describe("GetCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: GetCharacterSheetUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    useCase = new GetCharacterSheetUseCaseImpl(
      txRepos.characterSheets,
      groupAccessService,
      new FakeLogger(),
    );
  });

  it("renvoie la fiche complète si le demandeur est membre du groupe de la fiche", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", { peupleId: "peuple-1", vigueur: 6 }),
    );
    // « lecteur » est un autre membre du groupe (pas le propriétaire) : il peut voir la fiche.
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "lecteur" }));

    const result = await useCase.execute({ characterSheetId: "s-1", userId: "lecteur" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe("s-1");
    expect(result.value.name).toBe("Aragorn");
    expect(result.value.peupleId).toBe("peuple-1");
    expect(result.value.vigueur).toBe(6);
    expect(result.value.notes).toBeNull();
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche n'existe pas", async () => {
    const result = await useCase.execute({ characterSheetId: "ghost", userId: "owner-1" });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("échoue avec NOT_GROUP_MEMBER si le demandeur n'est pas membre du groupe de la fiche", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({ characterSheetId: "s-1", userId: "etranger" });

    expect(result.error).toBeInstanceOf(NotGroupMemberError);
  });
});
