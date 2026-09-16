import { describe, it, expect, beforeEach } from "vitest";
import { ListMySessionInvitationsUseCaseImpl } from "@application/features/session/usecases/ListMySessionInvitationsUseCaseImpl";
import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";
import { buildFakeTransactionalRepositories, buildTestCampaign, buildTestSession } from "./fakes";

describe("ListMySessionInvitationsUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: ListMySessionInvitationsUseCaseImpl;

  const invite = (sessionId: string, userId: string): void => {
    txRepos.sessionParticipants.seed(
      SessionParticipant.create({ sessionId, userId, invitedAt: new Date("2026-06-01T00:00:00Z") }),
    );
  };

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new ListMySessionInvitationsUseCaseImpl(
      txRepos.sessions,
      txRepos.campaigns,
      txRepos.sessionParticipants,
    );

    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "Ma campagne", "group-1"));
    txRepos.sessions.seed(buildTestSession("sess-1", "camp-1", "Donjon", "2026-06-20").openLobby());
    invite("sess-1", "player-2");
  });

  it("liste les invitations en attente du joueur (avec campagne + groupe)", async () => {
    const result = await useCase.execute({ actorUserId: "player-2" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      sessionId: "sess-1",
      title: "Donjon",
      date: "2026-06-20",
      campaignId: "camp-1",
      campaignName: "Ma campagne",
      groupId: "group-1",
    });
  });

  it("exclut les sessions qui ne sont plus en salon d'attente", async () => {
    // Session déjà démarrée (ACTIVE) : l'invitation n'a plus de sens.
    txRepos.sessions.seed(
      buildTestSession("sess-active", "camp-1").openLobby().start({ startedAt: new Date() }),
    );
    invite("sess-active", "player-2");

    const result = await useCase.execute({ actorUserId: "player-2" });

    expect(result.value.map((invitation) => invitation.sessionId)).toEqual(["sess-1"]);
  });

  it("renvoie une liste vide si le joueur n'a aucune invitation", async () => {
    const result = await useCase.execute({ actorUserId: "inconnu" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual([]);
  });
});
