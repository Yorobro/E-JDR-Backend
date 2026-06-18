import { describe, it, expect, beforeEach } from "vitest";
import { GetCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/GetCharacterSheetUseCaseImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { FakeLogger, buildFakeTransactionalRepositories, buildTestCharacterSheet } from "./fakes";

describe("GetCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: GetCharacterSheetUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new GetCharacterSheetUseCaseImpl(txRepos.characterSheets, new FakeLogger());
  });

  it("renvoie la fiche complète si le demandeur en est le propriétaire", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", { peupleId: "peuple-1", vigueur: 6 }),
    );

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "owner-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe("s-1");
    expect(result.value.name).toBe("Aragorn");
    expect(result.value.peupleId).toBe("peuple-1");
    expect(result.value.vigueur).toBe(6);
    expect(result.value.notes).toBeNull();
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche n'existe pas", async () => {
    const result = await useCase.execute({ characterSheetId: "ghost", ownerId: "owner-1" });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("échoue avec CharacterSheetAccessDeniedError si le demandeur n'est pas le propriétaire", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "autre" });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });
});
