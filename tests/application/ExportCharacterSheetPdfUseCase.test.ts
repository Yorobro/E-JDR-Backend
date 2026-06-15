import { describe, it, expect, beforeEach } from "vitest";
import { ExportCharacterSheetPdfUseCaseImpl } from "@application/features/character-sheet/usecases/ExportCharacterSheetPdfUseCaseImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import {
  FakeLogger,
  FakeCharacterSheetPdfGenerator,
  buildFakeTransactionalRepositories,
  buildTestCharacterSheet,
} from "./fakes";

describe("ExportCharacterSheetPdfUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: ExportCharacterSheetPdfUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new ExportCharacterSheetPdfUseCaseImpl(
      txRepos.characterSheets,
      new FakeCharacterSheetPdfGenerator(),
      new FakeLogger(),
    );
  });

  it("renvoie le PDF et un nom de fichier slugifié si le demandeur est le propriétaire", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1", "Aragorn le Rôdeur"));

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "owner-1" });

    expect(result.isSuccess).toBe(true);
    expect(Buffer.isBuffer(result.value.pdf)).toBe(true);
    expect(result.value.pdf.length).toBeGreaterThan(0);
    expect(result.value.fileName).toBe("fiche-aragorn-le-rodeur.pdf");
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
