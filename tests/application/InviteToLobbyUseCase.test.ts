import { describe, it, expect, beforeEach } from "vitest";
import { InviteToLobbyUseCaseImpl } from "@application/features/session/usecases/InviteToLobbyUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { NotGroupEditorError } from "@application/features/friend-group/errors/NotGroupEditorError";
import { EmptyParticipantSelectionError } from "@application/features/session/errors/EmptyParticipantSelectionError";
import { ParticipantNotInGroupError } from "@application/features/session/errors/ParticipantNotInGroupError";
import { LobbyNotOpenError } from "@application/features/session/errors/LobbyNotOpenError";
import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import {
  FakeLogger,
  FakeRealtimeNotifier,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestSession,
  buildTestMembership,
} from "./fakes";

describe("InviteToLobbyUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let notifier: FakeRealtimeNotifier;
  let useCase: InviteToLobbyUseCaseImpl;

  /** Pré-remplit une participation à « sess-1 » dans l'état voulu. */
  const seedParticipant = (userId: string, status: "INVITED" | "ACCEPTED" | "REFUSED"): void => {
    const invited = SessionParticipant.create({
      sessionId: "sess-1",
      userId,
      invitedAt: new Date("2026-06-20T18:00:00Z"),
    });
    const respondedAt = new Date("2026-06-20T18:05:00Z");
    txRepos.sessionParticipants.seed(
      status === "ACCEPTED"
        ? invited.accept({ respondedAt })
        : status === "REFUSED"
          ? invited.refuse({ respondedAt })
          : invited,
    );
  };

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    notifier = new FakeRealtimeNotifier();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    useCase = new InviteToLobbyUseCaseImpl({
      sessionRepository: txRepos.sessions,
      campaignRepository: txRepos.campaigns,
      sessionParticipantRepository: txRepos.sessionParticipants,
      groupMemberRepository: txRepos.groupMembers,
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
      realtimeNotifier: notifier,
    });

    // Campagne "camp-1" (groupe "group-1") + une session dont le lobby est déjà ouvert.
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "Ma campagne", "group-1"));
    txRepos.sessions.seed(buildTestSession("sess-1", "camp-1").openLobby());
    // Le MJ (éditeur) et trois joueurs membres.
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.MJ }),
    );
    for (const userId of ["player-2", "player-3", "player-4"]) {
      txRepos.groupMembers.seed(
        buildTestMembership({ groupId: "group-1", userId, role: GroupRole.MEMBER }),
      );
    }
  });

  it("convie un joueur oublié (nouvelle invitation INVITED) et notifie", async () => {
    seedParticipant("player-2", "ACCEPTED");

    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserIds: ["player-3"],
    });

    expect(result.isSuccess).toBe(true);
    // La session reste en LOBBY : seules les participations évoluent.
    expect(result.value.status).toBe("LOBBY");
    const stored = await txRepos.sessionParticipants.findBySessionId("sess-1");
    expect(stored.map((p) => `${p.userId}:${p.status.value}`).sort()).toEqual([
      "player-2:ACCEPTED",
      "player-3:INVITED",
    ]);
    // L'invitation apparaît chez le joueur convié, et le lobby se rafraîchit pour le groupe.
    expect(notifier.notifications).toContainEqual({
      kind: "user",
      id: "player-3",
      resource: "session-invitations",
    });
    expect(notifier.notifications).toContainEqual({
      kind: "group",
      id: "group-1",
      resource: "session-participants",
    });
  });

  it("réinvite un joueur ayant refusé (REFUSED → INVITED)", async () => {
    seedParticipant("player-2", "REFUSED");

    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserIds: ["player-2"],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.participants).toEqual([{ userId: "player-2", status: "INVITED" }]);
    const stored = await txRepos.sessionParticipants.findBySessionIdAndUserId("sess-1", "player-2");
    expect(stored!.status.value).toBe("INVITED");
    // L'invitation est réarmée : le joueur est de nouveau en attente de réponse.
    expect(stored!.respondedAt).toBeNull();
  });

  it("ignore un joueur déjà convié (INVITED ou ACCEPTED) sans échouer ni renotifier", async () => {
    seedParticipant("player-2", "INVITED");
    seedParticipant("player-3", "ACCEPTED");

    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserIds: ["player-2", "player-3"],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.participants.map((p) => `${p.userId}:${p.status}`).sort()).toEqual([
      "player-2:INVITED",
      "player-3:ACCEPTED",
    ]);
    // Rien n'a changé : aucune notification n'est émise.
    expect(notifier.notifications).toHaveLength(0);
  });

  it("renvoie le lobby complet (joueurs déjà présents inclus)", async () => {
    seedParticipant("player-2", "ACCEPTED");
    seedParticipant("player-3", "REFUSED");

    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserIds: ["player-3", "player-4"],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.participants.map((p) => `${p.userId}:${p.status}`).sort()).toEqual([
      "player-2:ACCEPTED",
      "player-3:INVITED",
      "player-4:INVITED",
    ]);
  });

  it("dédoublonne la sélection (même joueur choisi deux fois ⇒ une seule invitation)", async () => {
    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserIds: ["player-2", "player-2"],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.participants).toHaveLength(1);
  });

  it("échoue (SESSION_NOT_FOUND) si la session n'existe pas", async () => {
    const result = await useCase.execute({
      sessionId: "ghost",
      actorUserId: "mj-1",
      participantUserIds: ["player-2"],
    });

    expect(result.error).toBeInstanceOf(SessionNotFoundError);
  });

  it("échoue (CAMPAIGN_NOT_FOUND) si la campagne parente a disparu", async () => {
    txRepos.sessions.seed(buildTestSession("orpheline", "campagne-fantome").openLobby());

    const result = await useCase.execute({
      sessionId: "orpheline",
      actorUserId: "mj-1",
      participantUserIds: ["player-2"],
    });

    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue (NOT_GROUP_EDITOR) si le demandeur est un simple MEMBER", async () => {
    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "player-2",
      participantUserIds: ["player-3"],
    });

    expect(result.error).toBeInstanceOf(NotGroupEditorError);
    expect(await txRepos.sessionParticipants.findBySessionId("sess-1")).toHaveLength(0);
  });

  it("échoue (LOBBY_NOT_OPEN) si le salon n'est pas ouvert (session encore PLANNED)", async () => {
    txRepos.sessions.seed(buildTestSession("planifiee", "camp-1"));

    const result = await useCase.execute({
      sessionId: "planifiee",
      actorUserId: "mj-1",
      participantUserIds: ["player-2"],
    });

    expect(result.error).toBeInstanceOf(LobbyNotOpenError);
  });

  it("échoue (LOBBY_NOT_OPEN) si la partie a déjà démarré (ACTIVE)", async () => {
    txRepos.sessions.seed(
      buildTestSession("lancee", "camp-1").openLobby().start({ startedAt: new Date() }),
    );

    const result = await useCase.execute({
      sessionId: "lancee",
      actorUserId: "mj-1",
      participantUserIds: ["player-2"],
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("LOBBY_NOT_OPEN");
  });

  it("échoue (EMPTY_PARTICIPANT_SELECTION) si aucun joueur n'est sélectionné", async () => {
    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserIds: [],
    });

    expect(result.error).toBeInstanceOf(EmptyParticipantSelectionError);
  });

  it("échoue (PARTICIPANT_NOT_IN_GROUP) si un joueur choisi n'est pas membre", async () => {
    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserIds: ["player-2", "intrus"],
    });

    expect(result.error).toBeInstanceOf(ParticipantNotInGroupError);
    expect(await txRepos.sessionParticipants.findBySessionId("sess-1")).toHaveLength(0);
  });
});
