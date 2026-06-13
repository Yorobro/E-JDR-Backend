import { describe, it, expect, beforeEach } from "vitest";
import { CreateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/CreateCharacterSheetUseCaseImpl";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
} from "./fakes";

describe("CreateCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: CreateCharacterSheetUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new CreateCharacterSheetUseCaseImpl(
      new FakeIdGenerator(),
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
  });

  it("crée une fiche appartenant à l'utilisateur courant", async () => {
    const result = await useCase.execute({ ownerId: "user-1", name: "  Gimli  " });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Gimli");
    const stored = await txRepos.characterSheets.findByOwnerId("user-1");
    expect(stored).toHaveLength(1);
  });

  it("permet plusieurs fiches pour un même utilisateur", async () => {
    await useCase.execute({ ownerId: "user-1", name: "Une" });
    await useCase.execute({ ownerId: "user-1", name: "Deux" });
    expect(await txRepos.characterSheets.findByOwnerId("user-1")).toHaveLength(2);
  });

  it("échoue avec InvalidInputError si le nom est vide", async () => {
    const result = await useCase.execute({ ownerId: "user-1", name: "   " });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_CHARACTER_SHEET_NAME");
    expect(await txRepos.characterSheets.findByOwnerId("user-1")).toHaveLength(0);
  });
});
