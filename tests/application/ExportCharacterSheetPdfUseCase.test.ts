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
      txRepos.characterSheets,
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
      sheetSorts: txRepos.sheetSorts,
      sheetMiracles: txRepos.sheetMiracles,
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

  it("autorise le MJ de la campagne de la fiche à exporter la fiche", async () => {
    // La fiche appartient à owner-1 ; elle est rattachée à une campagne dont mj-7 est le MJ.
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1", "camp-1"),
    );
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-7", "Donjon", "group-1"));

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

  it("imprime des PV et une protection DÉRIVÉS (calculés), pas les valeurs stockées", async () => {
    txRepos.formations.seed(
      buildTestReferenceItem("form-1", "group-1", "Guerrier", { stat: "vigueur", amount: 2 }),
    );
    // Deux armures liées : protection 3 + 1 = 4.
    txRepos.armures.seed(buildTestReferenceItem("armure-1", "group-1", "Plastron", undefined, 3));
    txRepos.armures.seed(buildTestReferenceItem("armure-2", "group-1", "Bouclier", undefined, 1));
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {
        formationId: "form-1",
        vigueur: 5,
        pointsDeVie: 999,
        protection: 999,
      }),
    );
    await txRepos.sheetArmures.link("s-1", "armure-1");
    await txRepos.sheetArmures.link("s-1", "armure-2");

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "owner-1" });

    expect(result.isSuccess).toBe(true);
    // 10 + (5 + 2) = 17 ; protection 3 + 1 = 4 ; les 999 stockés sont écrasés.
    expect(pdfGenerator.lastDetail?.pointsDeVie).toBe(17);
    expect(pdfGenerator.lastDetail?.protection).toBe(4);
  });

  it("imprime le TOTAL des caractéristiques (base + bonus formation/peuple), pas la base seule", async () => {
    txRepos.formations.seed(
      buildTestReferenceItem("form-1", "group-1", "Diplomate", { stat: "social", amount: 2 }),
    );
    txRepos.peoples.seed(
      buildTestReferenceItem("peuple-1", "group-1", "Halfelin", { stat: "social", amount: 1 }),
    );
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Frodon", {
        social: 3,
        dexterite: 4,
        formationId: "form-1",
        peupleId: "peuple-1",
      }),
    );

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "owner-1" });

    expect(result.isSuccess).toBe(true);
    // Le PDF lit detail.social : il doit porter le total 3 + 2 + 1 = 6 (et non la base 3).
    expect(pdfGenerator.lastDetail?.social).toBe(6);
    expect(pdfGenerator.lastDetail?.socialTotale).toBe(6);
    // Une stat sans bonus reste à sa base.
    expect(pdfGenerator.lastDetail?.dexterite).toBe(4);
  });
});
