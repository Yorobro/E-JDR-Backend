import { describe, it, expect, beforeEach } from "vitest";
import { RespondToCampaignLinkRequestUseCaseImpl } from "@application/features/character-sheet/usecases/RespondToCampaignLinkRequestUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import {
  FakeLogger,
  FakeUnitOfWork,
  FakeRealtimeNotifier,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestCharacterSheet,
} from "./fakes";

describe("RespondToCampaignLinkRequestUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let notifier: FakeRealtimeNotifier;
  let useCase: RespondToCampaignLinkRequestUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    notifier = new FakeRealtimeNotifier();
    useCase = new RespondToCampaignLinkRequestUseCaseImpl(
      txRepos.campaigns,
      txRepos.characterSheets,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
      notifier,
    );
    // Campagne de mj-1 + fiche PENDING (owner-1) rattachée à cette campagne.
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "Donjon", "group-1"));
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Legolas", {}, "group-1", "camp-1"),
    );
  });

  it("accept : passe la fiche en ACCEPTED et notifie le propriétaire", async () => {
    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "s-1",
      actorUserId: "mj-1",
      accept: true,
    });

    expect(result.isSuccess).toBe(true);
    const accepted = await txRepos.characterSheets.findByCampaignIdAndStatus("camp-1", "ACCEPTED");
    expect(accepted.map((s) => s.id)).toEqual(["s-1"]);
    expect(notifier.notifications).toContainEqual({
      kind: "user",
      id: "owner-1",
      resource: "character-sheets",
    });
  });

  it("refuse : supprime la fiche", async () => {
    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "s-1",
      actorUserId: "mj-1",
      accept: false,
    });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.characterSheets.findById("s-1")).toBeNull();
  });

  it("échoue avec CharacterSheetAccessDeniedError si l'acteur n'est pas le MJ", async () => {
    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "s-1",
      actorUserId: "owner-1",
      accept: true,
    });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
    // La fiche reste inchangée (toujours PENDING).
    expect((await txRepos.characterSheets.findById("s-1"))?.isPending()).toBe(true);
  });

  it("échoue avec CampaignNotFoundError si la campagne n'existe pas", async () => {
    const result = await useCase.execute({
      campaignId: "ghost",
      characterSheetId: "s-1",
      actorUserId: "mj-1",
      accept: true,
    });

    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche est rattachée à une autre campagne", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-2", "mj-1", "Ailleurs", "group-1"));
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-2", "owner-2", "Gimli", {}, "group-1", "camp-2"),
    );

    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "s-2",
      actorUserId: "mj-1",
      accept: true,
    });

    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche n'est plus en attente (déjà ACCEPTED)", async () => {
    await txRepos.characterSheets.updateLinkStatus("s-1", "ACCEPTED");

    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "s-1",
      actorUserId: "mj-1",
      accept: true,
    });

    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });
});
