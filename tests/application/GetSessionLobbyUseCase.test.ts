import { describe, it, expect, beforeEach } from "vitest";
import { GetSessionLobbyUseCaseImpl } from "@application/features/session/usecases/GetSessionLobbyUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import {
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestSession,
  buildTestMembership,
} from "./fakes";

describe("GetSessionLobbyUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: GetSessionLobbyUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    useCase = new GetSessionLobbyUseCaseImpl(
      txRepos.sessions,
      txRepos.campaigns,
      txRepos.sessionParticipants,
      groupAccessService,
    );

    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "Ma campagne", "group-1"));
    txRepos.sessions.seed(buildTestSession("sess-1", "camp-1").openLobby());
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.MJ }),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "player-2", role: GroupRole.MEMBER }),
    );
    txRepos.sessionParticipants.seed(
      SessionParticipant.create({ sessionId: "sess-1", userId: "player-2", invitedAt: new Date() }),
    );
  });

  it("retourne le lobby (statut + participants) à un membre du groupe", async () => {
    const result = await useCase.execute({ sessionId: "sess-1", actorUserId: "player-2" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe("LOBBY");
    expect(result.value.participants).toEqual([{ userId: "player-2", status: "INVITED" }]);
  });

  it("échoue (SESSION_NOT_FOUND) si la session n'existe pas", async () => {
    const result = await useCase.execute({ sessionId: "ghost", actorUserId: "mj-1" });

    expect(result.error).toBeInstanceOf(SessionNotFoundError);
  });

  it("échoue (NOT_GROUP_MEMBER) si le demandeur n'est pas membre du groupe", async () => {
    const result = await useCase.execute({ sessionId: "sess-1", actorUserId: "etranger" });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_MEMBER");
  });
});
