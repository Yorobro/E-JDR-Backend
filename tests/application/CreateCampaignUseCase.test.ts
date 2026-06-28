import { describe, it, expect, beforeEach } from "vitest";
import { CreateCampaignUseCaseImpl } from "@application/features/campaign/usecases/CreateCampaignUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestMembership,
} from "./fakes";

describe("CreateCampaignUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: CreateCampaignUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.characterSheets,
    );
    const unitOfWork = new FakeUnitOfWork(txRepos);
    useCase = new CreateCampaignUseCaseImpl(
      new FakeIdGenerator(),
      groupAccessService,
      unitOfWork,
      new FakeLogger(),
    );
    // mj-1 est membre du groupe group-1
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "mj-1" }));
  });

  it("crée une campagne dans le groupe si l'utilisateur en est membre", async () => {
    const result = await useCase.execute({
      groupId: "group-1",
      gameMasterId: "mj-1",
      name: "  Donjon  ",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Donjon");
    expect(typeof result.value.id).toBe("string");

    const stored = await txRepos.campaigns.findByGroupId("group-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.name.value).toBe("Donjon");
  });

  it("permet de créer plusieurs campagnes dans le même groupe", async () => {
    await useCase.execute({ groupId: "group-1", gameMasterId: "mj-1", name: "Première" });
    await useCase.execute({ groupId: "group-1", gameMasterId: "mj-1", name: "Seconde" });

    const stored = await txRepos.campaigns.findByGroupId("group-1");
    expect(stored).toHaveLength(2);
  });

  it("échoue avec NOT_GROUP_MEMBER si le MJ n'est pas dans le groupe", async () => {
    const result = await useCase.execute({
      groupId: "group-inconnu",
      gameMasterId: "mj-1",
      name: "Test",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_MEMBER");
    expect(await txRepos.campaigns.findByGroupId("group-inconnu")).toHaveLength(0);
  });

  it("échoue avec InvalidInputError (INVALID_CAMPAIGN_NAME) si le nom est vide", async () => {
    const result = await useCase.execute({
      groupId: "group-1",
      gameMasterId: "mj-1",
      name: "   ",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_CAMPAIGN_NAME");

    expect(await txRepos.campaigns.findByGroupId("group-1")).toHaveLength(0);
  });

  it("autorise un MJ à créer une campagne", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "u-mj", role: GroupRole.MJ }),
    );
    const result = await useCase.execute({
      groupId: "group-1",
      gameMasterId: "u-mj",
      name: "Camp MJ",
    });
    expect(result.isSuccess).toBe(true);
  });

  it("refuse un MEMBER de créer une campagne (NOT_GROUP_EDITOR)", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "u-mem", role: GroupRole.MEMBER }),
    );
    const result = await useCase.execute({
      groupId: "group-1",
      gameMasterId: "u-mem",
      name: "Camp Member",
    });
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_EDITOR");
  });
});
