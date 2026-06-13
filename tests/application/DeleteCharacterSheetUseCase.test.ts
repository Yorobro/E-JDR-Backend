import { describe, it, expect, beforeEach } from "vitest";
import { DeleteCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/DeleteCharacterSheetUseCaseImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCharacterSheet,
} from "./fakes";

describe("DeleteCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: DeleteCharacterSheetUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new DeleteCharacterSheetUseCaseImpl(
      txRepos.characterSheets,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
  });

  it("supprime la fiche si le demandeur en est le propriétaire", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "owner-1" });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.characterSheets.findById("s-1")).toBeNull();
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche n'existe pas", async () => {
    const result = await useCase.execute({ characterSheetId: "ghost", ownerId: "owner-1" });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("échoue avec CharacterSheetAccessDeniedError si le demandeur n'est pas le propriétaire", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "autre" });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
    expect(await txRepos.characterSheets.findById("s-1")).not.toBeNull();
  });
});
