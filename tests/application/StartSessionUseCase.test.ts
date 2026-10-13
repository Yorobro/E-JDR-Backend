import { describe, it, expect, beforeEach } from "vitest";
import { StartSessionUseCaseImpl } from "@application/features/session/usecases/StartSessionUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { NotGroupEditorError } from "@application/features/friend-group/errors/NotGroupEditorError";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";
import {
  FakeLogger,
  FakeRealtimeNotifier,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestSession,
  buildTestMembership,
} from "./fakes";

describe("StartSessionUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let notifier: FakeRealtimeNotifier;
  let useCase: StartSessionUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    notifier = new FakeRealtimeNotifier();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    useCase = new StartSessionUseCaseImpl({
      sessionRepository: txRepos.sessions,
      campaignRepository: txRepos.campaigns,
      sessionParticipantRepository: txRepos.sessionParticipants,
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
      realtimeNotifier: notifier,
    });

    // Campagne "camp-1" (groupe "group-1") + une session déjà en LOBBY (prête à démarrer).
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "Ma campagne", "group-1"));
    txRepos.sessions.seed(buildTestSession("sess-1", "camp-1").openLobby());
    // Le MJ (éditeur) et un joueur membre.
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.MJ }),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "player-2", role: GroupRole.MEMBER }),
    );
  });

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

  it("démarre la session (LOBBY → ACTIVE), horodate et notifie le groupe", async () => {
    const result = await useCase.execute({ sessionId: "sess-1", actorUserId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    const stored = await txRepos.sessions.findById("sess-1");
    expect(stored!.status.value).toBe("ACTIVE");
    expect(stored!.startedAt).not.toBeNull();
    // Fait basculer le MJ et les joueurs vers l'écran de jeu via le canal du groupe.
    expect(notifier.notifications).toContainEqual({
      kind: "group",
      id: "group-1",
      resource: "session-status",
    });
  });

  it("prévient chaque joueur du salon sur son canal personnel, et le MJ", async () => {
    seedParticipant("player-2", "ACCEPTED");

    const result = await useCase.execute({ sessionId: "sess-1", actorUserId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    // `user:{id}` est abonné dès le handshake : le joueur reçoit le démarrage où qu'il soit
    // dans l'application, même hors de la page du salon (`group:{id}` ne porterait pas).
    expect(notifier.notifications).toContainEqual({
      kind: "user",
      id: "player-2",
      resource: "session-status",
    });
    // Le MJ aussi : il peut avoir quitté la page du salon avant de démarrer.
    expect(notifier.notifications).toContainEqual({
      kind: "user",
      id: "mj-1",
      resource: "session-status",
    });
  });

  it("ne prévient personnellement ni l'invité sans réponse ni celui qui a refusé", async () => {
    seedParticipant("player-2", "INVITED");
    seedParticipant("player-3", "REFUSED");

    await useCase.execute({ sessionId: "sess-1", actorUserId: "mj-1" });

    // Ni l'un ni l'autre n'occupe le salon : il n'y a rien à rediriger chez eux.
    const personal = notifier.notifications.filter((n) => n.kind === "user");
    expect(personal.map((n) => n.id)).toEqual(["mj-1"]);
  });

  it("échoue (SESSION_NOT_FOUND) si la session n'existe pas", async () => {
    const result = await useCase.execute({ sessionId: "ghost", actorUserId: "mj-1" });

    expect(result.error).toBeInstanceOf(SessionNotFoundError);
  });

  it("échoue (CAMPAIGN_NOT_FOUND) si la campagne parente a disparu", async () => {
    txRepos.sessions.seed(buildTestSession("orpheline", "campagne-fantome").openLobby());

    const result = await useCase.execute({ sessionId: "orpheline", actorUserId: "mj-1" });

    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue (NOT_GROUP_EDITOR) si le demandeur est un simple MEMBER", async () => {
    const result = await useCase.execute({ sessionId: "sess-1", actorUserId: "player-2" });

    expect(result.error).toBeInstanceOf(NotGroupEditorError);
    // La session reste en LOBBY : aucune transition n'a eu lieu.
    const stored = await txRepos.sessions.findById("sess-1");
    expect(stored!.status.value).toBe("LOBBY");
  });

  it("échoue (SESSION_NOT_STARTABLE) si la session n'est pas en lobby", async () => {
    // Session encore PLANNED (lobby pas ouvert).
    txRepos.sessions.seed(buildTestSession("planifiee", "camp-1"));

    const result = await useCase.execute({ sessionId: "planifiee", actorUserId: "mj-1" });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("SESSION_NOT_STARTABLE");
  });
});
