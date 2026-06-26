import { describe, it, expect, beforeEach } from "vitest";
import { CopyCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/CopyCharacterSheetUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { GameMasterCannotJoinOwnCampaignError } from "@application/features/character-sheet/errors/GameMasterCannotJoinOwnCampaignError";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  FakeRealtimeNotifier,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestCharacterSheet,
  buildTestReferenceItem,
} from "./fakes";

describe("CopyCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let notifier: FakeRealtimeNotifier;
  let useCase: CopyCharacterSheetUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    notifier = new FakeRealtimeNotifier();
    useCase = new CopyCharacterSheetUseCaseImpl({
      idGenerator: new FakeIdGenerator(),
      campaignRepository: txRepos.campaigns,
      characterSheetRepository: txRepos.characterSheets,
      sourceLinks: {
        armes: txRepos.sheetArmes,
        armures: txRepos.sheetArmures,
        competences: txRepos.sheetCompetences,
        equipements: txRepos.sheetEquipements,
        sorts: txRepos.sheetSorts,
        miracles: txRepos.sheetMiracles,
      },
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
      realtimeNotifier: notifier,
    });
    // Fiche source (owner-1) dans group-1, rattachée à camp-source.
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("src", "owner-1", "Aragorn", {}, "group-1", "camp-source"),
    );
    // Campagne cible du MÊME groupe, tenue par un autre MJ (mj-2).
    txRepos.campaigns.seed(buildTestCampaign("camp-cible", "mj-2", "Cible", "group-1"));
  });

  it("happy path : produit une nouvelle fiche PENDING avec un nouvel id et copie les liaisons N‑N", async () => {
    // La fiche source porte une arme liée (à recopier vers la nouvelle fiche).
    txRepos.armes.seed(buildTestReferenceItem("arme-1", "group-1", "Andúril"));
    await txRepos.sheetArmes.link("src", "arme-1", new Date());

    const result = await useCase.execute({
      sourceSheetId: "src",
      targetCampaignId: "camp-cible",
      actorUserId: "owner-1",
    });

    expect(result.isSuccess).toBe(true);
    const newId = result.value.id;
    expect(newId).not.toBe("src");
    expect(result.value.ownerId).toBe("owner-1");
    expect(result.value.name).toBe("Aragorn");

    // La copie existe, est rattachée à la campagne cible, en statut PENDING.
    const copy = await txRepos.characterSheets.findById(newId);
    expect(copy).not.toBeNull();
    expect(copy!.campaignId).toBe("camp-cible");
    expect(copy!.isPending()).toBe(true);

    // Les liaisons N‑N (armes) ont été recopiées vers la nouvelle fiche.
    const copiedArmes = await txRepos.sheetArmes.findItemsBySheet(newId);
    expect(copiedArmes.map((i) => i.id)).toEqual(["arme-1"]);

    // Notifie le propriétaire (ses fiches) et le MJ de la cible (une demande en attente).
    expect(notifier.notifications).toContainEqual({
      kind: "user",
      id: "owner-1",
      resource: "character-sheets",
    });
    expect(notifier.notifications).toContainEqual({
      kind: "user",
      id: "mj-2",
      resource: "campaign-pending-characters",
    });
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche source n'existe pas", async () => {
    const result = await useCase.execute({
      sourceSheetId: "ghost",
      targetCampaignId: "camp-cible",
      actorUserId: "owner-1",
    });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("échoue avec CharacterSheetAccessDeniedError si l'acteur n'est pas le propriétaire de la source", async () => {
    const result = await useCase.execute({
      sourceSheetId: "src",
      targetCampaignId: "camp-cible",
      actorUserId: "autre",
    });
    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("échoue avec CampaignNotFoundError si la campagne cible n'existe pas", async () => {
    const result = await useCase.execute({
      sourceSheetId: "src",
      targetCampaignId: "inconnue",
      actorUserId: "owner-1",
    });
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue avec CharacterSheetAccessDeniedError si la campagne cible est dans un autre groupe", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-autre", "mj-3", "Ailleurs", "group-2"));

    const result = await useCase.execute({
      sourceSheetId: "src",
      targetCampaignId: "camp-autre",
      actorUserId: "owner-1",
    });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("échoue avec GameMasterCannotJoinOwnCampaignError si l'acteur est le MJ de la cible", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-sienne", "owner-1", "Sienne", "group-1"));

    const result = await useCase.execute({
      sourceSheetId: "src",
      targetCampaignId: "camp-sienne",
      actorUserId: "owner-1",
    });

    expect(result.error).toBeInstanceOf(GameMasterCannotJoinOwnCampaignError);
  });
});
