import { describe, it, expect, beforeEach } from "vitest";
import { CreateSessionUseCaseImpl } from "@application/features/session/usecases/CreateSessionUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { NotGroupEditorError } from "@application/features/friend-group/errors/NotGroupEditorError";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestMembership,
} from "./fakes";

describe("CreateSessionUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: CreateSessionUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    useCase = new CreateSessionUseCaseImpl(
      txRepos.campaigns,
      new FakeIdGenerator(),
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
      groupAccessService,
    );
    // La campagne "camp-1" appartient au groupe "group-1"
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "Ma campagne", "group-1"));
  });

  it("crée une session quand le demandeur est éditeur du groupe (ADMIN)", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.ADMIN }),
    );

    const result = await useCase.execute({
      campaignId: "camp-1",
      actorUserId: "mj-1",
      title: "  Le réveil du dragon  ",
      date: "2026-06-20",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.title).toBe("Le réveil du dragon"); // normalisé (trim)
    expect(result.value.campaignId).toBe("camp-1");
    expect(result.value.date).toBe("2026-06-20");

    const stored = await txRepos.sessions.findByCampaignId("camp-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.title.value).toBe("Le réveil du dragon");
  });

  it("crée une session quand le demandeur est éditeur du groupe (MJ)", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.MJ }),
    );

    const result = await useCase.execute({
      campaignId: "camp-1",
      actorUserId: "mj-1",
      title: "Session MJ",
      date: "2026-06-20",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.title).toBe("Session MJ");
  });

  it("échoue (404) si la campagne n'existe pas", async () => {
    const result = await useCase.execute({
      campaignId: "ghost",
      actorUserId: "mj-1",
      title: "Session",
      date: "2026-06-20",
    });

    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
    expect(await txRepos.sessions.findByCampaignId("ghost")).toHaveLength(0);
  });

  it("échoue (NOT_GROUP_EDITOR) si le demandeur est MEMBER du groupe", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "membre", role: GroupRole.MEMBER }),
    );

    const result = await useCase.execute({
      campaignId: "camp-1",
      actorUserId: "membre",
      title: "Session",
      date: "2026-06-20",
    });

    expect(result.error).toBeInstanceOf(NotGroupEditorError);
    expect(await txRepos.sessions.findByCampaignId("camp-1")).toHaveLength(0);
  });

  it("échoue (NOT_GROUP_MEMBER) si le demandeur n'est pas membre du groupe", async () => {
    const result = await useCase.execute({
      campaignId: "camp-1",
      actorUserId: "inconnu",
      title: "Session",
      date: "2026-06-20",
    });

    expect(result.error).toBeInstanceOf(NotGroupMemberError);
    expect(await txRepos.sessions.findByCampaignId("camp-1")).toHaveLength(0);
  });

  it("échoue (INVALID_SESSION_TITLE) si le titre est vide", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.ADMIN }),
    );

    const result = await useCase.execute({
      campaignId: "camp-1",
      actorUserId: "mj-1",
      title: "   ",
      date: "2026-06-20",
    });

    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_SESSION_TITLE");
  });

  it("échoue (INVALID_SESSION_DATE) si la date est mal formée", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.ADMIN }),
    );

    const result = await useCase.execute({
      campaignId: "camp-1",
      actorUserId: "mj-1",
      title: "Session",
      date: "20/06/2026",
    });

    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_SESSION_DATE");
  });
});
