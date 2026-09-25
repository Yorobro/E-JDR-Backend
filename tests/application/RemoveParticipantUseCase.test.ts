import { describe, it, expect, beforeEach } from "vitest";
import { RemoveParticipantUseCaseImpl } from "@application/features/session/usecases/RemoveParticipantUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { NotGroupEditorError } from "@application/features/friend-group/errors/NotGroupEditorError";
import { LobbyNotOpenError } from "@application/features/session/errors/LobbyNotOpenError";
import { ParticipantNotFoundError } from "@application/features/session/errors/ParticipantNotFoundError";
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

describe("RemoveParticipantUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let notifier: FakeRealtimeNotifier;
  let useCase: RemoveParticipantUseCaseImpl;

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
    useCase = new RemoveParticipantUseCaseImpl({
      sessionRepository: txRepos.sessions,
      campaignRepository: txRepos.campaigns,
      sessionParticipantRepository: txRepos.sessionParticipants,
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

  it("retire le joueur et renvoie le lobby sans lui", async () => {
    seedParticipant("player-2", "ACCEPTED");
    seedParticipant("player-3", "INVITED");

    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserId: "player-2",
    });

    expect(result.isSuccess).toBe(true);
    // La session reste en LOBBY : seule la participation disparaît.
    expect(result.value.status).toBe("LOBBY");
    expect(result.value.participants).toEqual([{ userId: "player-3", status: "INVITED" }]);
    // Et la suppression est bien allée en base, pas seulement dans la vue renvoyée.
    const stored = await txRepos.sessionParticipants.findBySessionId("sess-1");
    expect(stored.map((p) => p.userId)).toEqual(["player-3"]);
  });

  it("retire un joueur encore INVITED (il n'avait pas répondu)", async () => {
    seedParticipant("player-2", "INVITED");

    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserId: "player-2",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.participants).toHaveLength(0);
    expect(
      await txRepos.sessionParticipants.findBySessionIdAndUserId("sess-1", "player-2"),
    ).toBeNull();
  });

  it("ne retire que le joueur visé, pas ses voisins de même session", async () => {
    seedParticipant("player-2", "ACCEPTED");
    seedParticipant("player-3", "REFUSED");
    seedParticipant("player-4", "INVITED");

    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserId: "player-3",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.participants.map((p) => `${p.userId}:${p.status}`).sort()).toEqual([
      "player-2:ACCEPTED",
      "player-4:INVITED",
    ]);
  });

  it("notifie le joueur retiré et le groupe", async () => {
    seedParticipant("player-2", "INVITED");

    await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserId: "player-2",
    });

    // L'invitation en attente disparaît de l'écran du joueur retiré...
    expect(notifier.notifications).toContainEqual({
      kind: "user",
      id: "player-2",
      resource: "session-invitations",
    });
    // ...et le lobby se rafraîchit pour tout le groupe.
    expect(notifier.notifications).toContainEqual({
      kind: "group",
      id: "group-1",
      resource: "session-participants",
    });
  });

  it("échoue (SESSION_NOT_FOUND) si la session n'existe pas", async () => {
    const result = await useCase.execute({
      sessionId: "ghost",
      actorUserId: "mj-1",
      participantUserId: "player-2",
    });

    expect(result.error).toBeInstanceOf(SessionNotFoundError);
  });

  it("échoue (CAMPAIGN_NOT_FOUND) si la campagne parente a disparu", async () => {
    txRepos.sessions.seed(buildTestSession("orpheline", "campagne-fantome").openLobby());

    const result = await useCase.execute({
      sessionId: "orpheline",
      actorUserId: "mj-1",
      participantUserId: "player-2",
    });

    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue (NOT_GROUP_EDITOR) si le demandeur est un simple MEMBER, sans rien supprimer", async () => {
    seedParticipant("player-2", "ACCEPTED");
    seedParticipant("player-3", "INVITED");

    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "player-3",
      participantUserId: "player-2",
    });

    expect(result.error).toBeInstanceOf(NotGroupEditorError);
    // Un refus d'autorisation ne doit laisser aucune trace : le lobby est intact.
    expect(await txRepos.sessionParticipants.findBySessionId("sess-1")).toHaveLength(2);
    expect(notifier.notifications).toHaveLength(0);
  });

  it("échoue (LOBBY_NOT_OPEN) si le salon n'est pas encore ouvert (session PLANNED)", async () => {
    txRepos.sessions.seed(buildTestSession("planifiee", "camp-1"));

    const result = await useCase.execute({
      sessionId: "planifiee",
      actorUserId: "mj-1",
      participantUserId: "player-2",
    });

    expect(result.error).toBeInstanceOf(LobbyNotOpenError);
  });

  it("échoue (LOBBY_NOT_OPEN) si la partie a déjà démarré (ACTIVE)", async () => {
    txRepos.sessions.seed(
      buildTestSession("lancee", "camp-1").openLobby().start({ startedAt: new Date() }),
    );
    txRepos.sessionParticipants.seed(
      SessionParticipant.create({
        sessionId: "lancee",
        userId: "player-2",
        invitedAt: new Date("2026-06-20T18:00:00Z"),
      }),
    );

    const result = await useCase.execute({
      sessionId: "lancee",
      actorUserId: "mj-1",
      participantUserId: "player-2",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("LOBBY_NOT_OPEN");
    // Le statut prime sur l'existence du participant : rien n'est supprimé.
    expect(await txRepos.sessionParticipants.findBySessionId("lancee")).toHaveLength(1);
  });

  it("échoue (PARTICIPANT_NOT_FOUND) si le joueur n'était pas convié", async () => {
    seedParticipant("player-2", "ACCEPTED");

    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserId: "player-4",
    });

    expect(result.error).toBeInstanceOf(ParticipantNotFoundError);
    // Échec explicite plutôt que succès silencieux : le lobby n'a pas bougé.
    expect(await txRepos.sessionParticipants.findBySessionId("sess-1")).toHaveLength(1);
    expect(notifier.notifications).toHaveLength(0);
  });
});
