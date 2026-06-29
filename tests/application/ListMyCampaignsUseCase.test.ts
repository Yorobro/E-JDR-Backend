import { describe, it, expect, beforeEach } from "vitest";
import { ListMyCampaignsUseCaseImpl } from "@application/features/campaign/usecases/ListMyCampaignsUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import {
  FakeCampaignRepository,
  FakeGroupMemberRepository,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestMembership,
} from "./fakes";

describe("ListMyCampaignsUseCaseImpl", () => {
  let campaignRepo: FakeCampaignRepository;
  let memberRepo: FakeGroupMemberRepository;
  let useCase: ListMyCampaignsUseCaseImpl;

  beforeEach(() => {
    const txRepos = buildFakeTransactionalRepositories();
    campaignRepo = txRepos.campaigns;
    memberRepo = txRepos.groupMembers;
    const groupAccessService = new GroupAccessServiceImpl(
      memberRepo,
      txRepos.campaigns,
      txRepos.characterSheets,
    );
    useCase = new ListMyCampaignsUseCaseImpl(campaignRepo, groupAccessService);
    // user-1 est membre de group-1
    memberRepo.seed(buildTestMembership({ groupId: "group-1", userId: "user-1" }));
  });

  it("ne renvoie que les campagnes du groupe demandé", async () => {
    campaignRepo.seed(buildTestCampaign("c-1", "mj-1", "Alpha", "group-1"));
    campaignRepo.seed(buildTestCampaign("c-2", "mj-1", "Beta", "group-1"));
    campaignRepo.seed(buildTestCampaign("c-3", "mj-1", "Gamma", "group-2"));

    const result = await useCase.execute({ groupId: "group-1", userId: "user-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(2);
    expect(result.value.map((c) => c.name).sort()).toEqual(["Alpha", "Beta"]);
  });

  it("renvoie une liste vide si le groupe n'a aucune campagne", async () => {
    const result = await useCase.execute({ groupId: "group-1", userId: "user-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual([]);
  });

  it("échoue avec NOT_GROUP_MEMBER si l'utilisateur n'est pas dans le groupe", async () => {
    const result = await useCase.execute({ groupId: "group-1", userId: "outsider" });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_MEMBER");
  });

  it("projette chaque campagne en résumé (id, name string, gameMasterId, createdAt)", async () => {
    campaignRepo.seed(buildTestCampaign("c-1", "mj-1", "Alpha", "group-1"));

    const result = await useCase.execute({ groupId: "group-1", userId: "user-1" });

    expect(result.value[0]).toEqual({
      id: "c-1",
      name: "Alpha",
      gameMasterId: "mj-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
  });
});
