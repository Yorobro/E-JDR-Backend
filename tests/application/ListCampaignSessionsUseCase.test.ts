import { describe, it, expect, beforeEach } from "vitest";
import { ListCampaignSessionsUseCaseImpl } from "@application/features/session/usecases/ListCampaignSessionsUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import {
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestSession,
  buildTestMembership,
} from "./fakes";

describe("ListCampaignSessionsUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: ListCampaignSessionsUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.characterSheets,
    );
    useCase = new ListCampaignSessionsUseCaseImpl(
      txRepos.campaigns,
      txRepos.sessions,
      groupAccessService,
    );
    // Campagne dans group-1
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "Ma campagne", "group-1"));
  });

  it("liste les sessions d'une campagne pour un MEMBER du groupe (de la plus récente à la plus ancienne)", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.MEMBER }),
    );
    txRepos.sessions.seed(buildTestSession("s-old", "camp-1", "Ancienne", "2026-01-10"));
    txRepos.sessions.seed(buildTestSession("s-new", "camp-1", "Récente", "2026-06-20"));
    // Session d'une autre campagne : ne doit pas apparaître.
    txRepos.sessions.seed(buildTestSession("s-other", "camp-2", "Autre", "2026-05-01"));

    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.map((s) => s.id)).toEqual(["s-new", "s-old"]);
  });

  it("liste les sessions pour un éditeur du groupe (ADMIN)", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.ADMIN }),
    );
    txRepos.sessions.seed(buildTestSession("s-1", "camp-1", "Session", "2026-06-20"));

    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(1);
  });

  it("retourne une liste vide si la campagne n'a aucune session", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.MEMBER }),
    );
    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "mj-1" });
    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(0);
  });

  it("échoue (404) si la campagne n'existe pas", async () => {
    const result = await useCase.execute({ campaignId: "ghost", actorUserId: "mj-1" });
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue (NOT_GROUP_MEMBER) si le demandeur n'est pas membre du groupe", async () => {
    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "inconnu" });
    expect(result.error).toBeInstanceOf(NotGroupMemberError);
  });

  it("liste les sessions même pour un MEMBER (lecture autorisée pour tous les membres)", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "membre", role: GroupRole.MEMBER }),
    );
    txRepos.sessions.seed(buildTestSession("s-1", "camp-1", "Session visible", "2026-06-20"));

    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "membre" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(1);
  });

  it("un MEMBER peut lire (requireMember, pas requireEditor)", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "membre", role: GroupRole.MEMBER }),
    );

    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "membre" });

    // Un MEMBER peut lire — le résultat est un succès, pas une erreur d'édition
    expect(result.isSuccess).toBe(true);
    expect(result.isFailure).toBe(false);
  });
});
