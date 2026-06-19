import { describe, it, expect, beforeEach } from "vitest";
import { ExportCharacterSheetPdfUseCaseImpl } from "@application/features/character-sheet/usecases/ExportCharacterSheetPdfUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import {
  FakeLogger,
  FakeCharacterSheetPdfGenerator,
  buildFakeTransactionalRepositories,
  buildTestCharacterSheet,
  buildTestCampaign,
  buildTestReferenceItem,
} from "./fakes";

describe("ExportCharacterSheetPdfUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let pdfGenerator: FakeCharacterSheetPdfGenerator;
  let useCase: ExportCharacterSheetPdfUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    pdfGenerator = new FakeCharacterSheetPdfGenerator();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    useCase = new ExportCharacterSheetPdfUseCaseImpl({
      characterSheetRepository: txRepos.characterSheets,
      pdfGenerator,
      logger: new FakeLogger(),
      groupAccessService,
      formationRepository: txRepos.formations,
      peupleRepository: txRepos.peoples,
      competenceRepository: txRepos.competences,
      formationCompetenceLink: txRepos.formationCompetences,
      sheetArmes: txRepos.sheetArmes,
      sheetArmures: txRepos.sheetArmures,
      sheetCompetences: txRepos.sheetCompetences,
      sheetEquipements: txRepos.sheetEquipements,
    });
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

  it("échoue avec CharacterSheetAccessDeniedError si le demandeur n'est ni propriétaire ni MJ", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "autre" });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("autorise le MJ d'une campagne où la fiche est liée à exporter la fiche", async () => {
    // La fiche appartient à owner-1 ; elle est liée à une campagne dont mj-7 est le MJ.
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1", "Aragorn"));
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-7", "Donjon", "group-1"));
    await txRepos.campaignCharacters.link("camp-1", "s-1");

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "mj-7" });

    expect(result.isSuccess).toBe(true);
    expect(Buffer.isBuffer(result.value.pdf)).toBe(true);
  });

  it("transmet au générateur des references résolues (nom de formation + armes liées)", async () => {
    txRepos.formations.seed(buildTestReferenceItem("form-1", "group-1", "Guerrier"));
    txRepos.armes.seed(buildTestReferenceItem("arme-1", "group-1", "Épée longue"));
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", { formationId: "form-1" }),
    );
    await txRepos.sheetArmes.link("s-1", "arme-1");

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "owner-1" });

    expect(result.isSuccess).toBe(true);
    expect(pdfGenerator.lastReferences).not.toBeNull();
    expect(pdfGenerator.lastReferences?.formationName).toBe("Guerrier");
    expect(pdfGenerator.lastReferences?.armes).toEqual(["Épée longue"]);
  });
});
