import { describe, it, expect, beforeEach } from "vitest";
import { DeleteCampaignUseCaseImpl } from "@application/features/campaign/usecases/DeleteCampaignUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CampaignAccessDeniedError } from "@application/features/campaign/errors/CampaignAccessDeniedError";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestMembership,
} from "./fakes";

describe("DeleteCampaignUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: DeleteCampaignUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    const unitOfWork = new FakeUnitOfWork(txRepos);
    useCase = new DeleteCampaignUseCaseImpl(
      txRepos.campaigns,
      groupAccessService,
      unitOfWork,
      new FakeLogger(),
    );
    // mj-1 est le MJ ET membre du groupe group-1.
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "mj-1" }));
  });

  it("supprime la campagne si le demandeur en est le MJ et toujours membre du groupe", async () => {
    txRepos.campaigns.seed(buildTestCampaign("c-1", "mj-1", "À supprimer", "group-1"));

    const result = await useCase.execute({ campaignId: "c-1", gameMasterId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.campaigns.findById("c-1")).toBeNull();
  });

  it("échoue avec CampaignNotFoundError si la campagne n'existe pas", async () => {
    const result = await useCase.execute({ campaignId: "inconnu", gameMasterId: "mj-1" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue avec CampaignAccessDeniedError si le demandeur n'est pas le MJ, sans supprimer", async () => {
    txRepos.campaigns.seed(buildTestCampaign("c-1", "mj-1", "Privée", "group-1"));
    // « autre » est membre du groupe mais n'est pas le MJ.
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "autre" }));

    const result = await useCase.execute({ campaignId: "c-1", gameMasterId: "autre" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(CampaignAccessDeniedError);
    // La campagne n'a PAS été supprimée.
    expect(await txRepos.campaigns.findById("c-1")).not.toBeNull();
  });

  it("échoue avec NOT_GROUP_MEMBER si le MJ n'est plus membre du groupe, sans supprimer", async () => {
    // ex-mj est le MJ de la campagne mais n'a PAS de membership dans group-1.
    txRepos.campaigns.seed(buildTestCampaign("c-1", "ex-mj", "Orpheline", "group-1"));

    const result = await useCase.execute({ campaignId: "c-1", gameMasterId: "ex-mj" });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_MEMBER");
    expect(await txRepos.campaigns.findById("c-1")).not.toBeNull();
  });

  it("autorise un MJ à supprimer sa campagne", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "u-mj", role: GroupRole.MJ }),
    );
    txRepos.campaigns.seed(buildTestCampaign("c-mj", "u-mj", "Camp MJ", "group-1"));
    const result = await useCase.execute({ campaignId: "c-mj", gameMasterId: "u-mj" });
    expect(result.isSuccess).toBe(true);
  });

  it("refuse un MEMBER de supprimer sa campagne (NOT_GROUP_EDITOR)", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "u-mem", role: GroupRole.MEMBER }),
    );
    txRepos.campaigns.seed(buildTestCampaign("c-mem", "u-mem", "Camp Member", "group-1"));
    const result = await useCase.execute({ campaignId: "c-mem", gameMasterId: "u-mem" });
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_EDITOR");
  });
});
