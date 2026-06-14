import { describe, it, expect, beforeEach } from "vitest";
import { UpdateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/UpdateCharacterSheetUseCaseImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCharacterSheet,
} from "./fakes";

describe("UpdateCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: UpdateCharacterSheetUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new UpdateCharacterSheetUseCaseImpl(
      txRepos.characterSheets,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
  });

  it("met à jour le nom et les champs détaillés, en préservant id/ownerId/createdAt", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1", "Aragorn"));

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "Strider",
      peuple: "Rôdeur",
      vigueur: 7,
      notes: "  Garde du Nord  ",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Strider");
    expect(result.value.peuple).toBe("Rôdeur");
    expect(result.value.vigueur).toBe(7);
    expect(result.value.notes).toBe("Garde du Nord"); // trim
    expect(result.value.id).toBe("s-1");
    expect(result.value.ownerId).toBe("owner-1");

    const persisted = await txRepos.characterSheets.findById("s-1");
    expect(persisted!.name.value).toBe("Strider");
    expect(persisted!.details.vigueur).toBe(7);
  });

  it("normalise les entiers négatifs à 0", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "Aragorn",
      monnaie: -50,
    });

    expect(result.value.monnaie).toBe(0);
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche n'existe pas", async () => {
    const result = await useCase.execute({
      characterSheetId: "ghost",
      ownerId: "owner-1",
      name: "X",
    });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("échoue avec CharacterSheetAccessDeniedError si le demandeur n'est pas le propriétaire", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "autre",
      name: "X",
    });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("échoue avec InvalidInputError si le nom est invalide", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "   ",
    });

    expect(result.error).toBeInstanceOf(InvalidInputError);
  });
});
