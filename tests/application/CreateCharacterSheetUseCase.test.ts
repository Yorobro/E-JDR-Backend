import { describe, it, expect, beforeEach } from "vitest";
import { CreateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/CreateCharacterSheetUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { GameMasterCannotJoinOwnCampaignError } from "@application/features/character-sheet/errors/GameMasterCannotJoinOwnCampaignError";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  FakeRealtimeNotifier,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestMembership,
} from "./fakes";

describe("CreateCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let notifier: FakeRealtimeNotifier;
  let useCase: CreateCharacterSheetUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    notifier = new FakeRealtimeNotifier();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.characterSheets,
    );
    useCase = new CreateCharacterSheetUseCaseImpl(
      new FakeIdGenerator(),
      txRepos.campaigns,
      groupAccessService,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
      notifier,
    );
    // user-1 est membre du groupe group-1.
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "user-1" }));
    // Campagne du groupe, dont le MJ (mj-1) n'est PAS user-1 (user-1 peut donc y jouer).
    txRepos.campaigns.seed(buildTestCampaign("campaign-1", "mj-1", "Ma campagne", "group-1"));
  });

  it("crée une fiche PENDING appartenant à l'utilisateur, rattachée à la campagne", async () => {
    const result = await useCase.execute({
      ownerId: "user-1",
      groupId: "group-1",
      campaignId: "campaign-1",
      name: "  Gimli  ",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Gimli");
    const stored = await txRepos.characterSheets.findByGroupId("group-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.ownerId).toBe("user-1");
    expect(stored[0]!.groupId).toBe("group-1");
    expect(stored[0]!.campaignId).toBe("campaign-1");
    expect(stored[0]!.isPending()).toBe(true);
  });

  it("notifie le propriétaire et le MJ (temps réel) après une création réussie", async () => {
    await useCase.execute({
      ownerId: "user-1",
      groupId: "group-1",
      campaignId: "campaign-1",
      name: "Gimli",
    });

    expect(notifier.notifications).toEqual([
      { kind: "user", id: "user-1", resource: "character-sheets" },
      { kind: "user", id: "mj-1", resource: "campaign-pending-characters" },
    ]);
  });

  it("ne notifie pas si la création échoue (non membre du groupe)", async () => {
    await useCase.execute({
      ownerId: "user-1",
      groupId: "group-inconnu",
      campaignId: "campaign-1",
      name: "Gimli",
    });

    expect(notifier.notifications).toHaveLength(0);
  });

  it("échoue avec NOT_GROUP_MEMBER si l'utilisateur n'est pas membre du groupe", async () => {
    const result = await useCase.execute({
      ownerId: "user-1",
      groupId: "group-inconnu",
      campaignId: "campaign-1",
      name: "Gimli",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_MEMBER");
    expect(await txRepos.characterSheets.findByGroupId("group-inconnu")).toHaveLength(0);
  });

  it("échoue avec CampaignNotFoundError si la campagne n'existe pas", async () => {
    const result = await useCase.execute({
      ownerId: "user-1",
      groupId: "group-1",
      campaignId: "campagne-inconnue",
      name: "Gimli",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue avec CHARACTER_SHEET_ACCESS_DENIED si la campagne est dans un autre groupe", async () => {
    txRepos.campaigns.seed(buildTestCampaign("campaign-autre", "mj-2", "Ailleurs", "group-2"));

    const result = await useCase.execute({
      ownerId: "user-1",
      groupId: "group-1",
      campaignId: "campaign-autre",
      name: "Gimli",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("échoue avec GM_CANNOT_JOIN_OWN_CAMPAIGN si le propriétaire est le MJ de la campagne", async () => {
    // mj-membre est à la fois membre du groupe et MJ de sa propre campagne.
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "mj-membre" }));
    txRepos.campaigns.seed(buildTestCampaign("campaign-mj", "mj-membre", "Sa campagne", "group-1"));

    const result = await useCase.execute({
      ownerId: "mj-membre",
      groupId: "group-1",
      campaignId: "campaign-mj",
      name: "Gimli",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(GameMasterCannotJoinOwnCampaignError);
  });

  it("échoue avec InvalidInputError si le nom est vide", async () => {
    const result = await useCase.execute({
      ownerId: "user-1",
      groupId: "group-1",
      campaignId: "campaign-1",
      name: "   ",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_CHARACTER_SHEET_NAME");
    expect(await txRepos.characterSheets.findByGroupId("group-1")).toHaveLength(0);
  });
});
