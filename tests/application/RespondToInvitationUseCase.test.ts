import { describe, it, expect, beforeEach } from "vitest";
import { RespondToInvitationUseCaseImpl } from "@application/features/session/usecases/RespondToInvitationUseCaseImpl";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { SessionNotJoinableError } from "@application/features/session/errors/SessionNotJoinableError";
import { ParticipantNotFoundError } from "@application/features/session/errors/ParticipantNotFoundError";
import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";
import {
  FakeLogger,
  FakeRealtimeNotifier,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestSession,
} from "./fakes";

describe("RespondToInvitationUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let notifier: FakeRealtimeNotifier;
  let useCase: RespondToInvitationUseCaseImpl;

  /** Aide : invite `userId` (statut INVITED) à la session `sessionId`. */
  const seedInvitation = (sessionId: string, userId: string): void => {
    txRepos.sessionParticipants.seed(
      SessionParticipant.create({ sessionId, userId, invitedAt: new Date("2026-06-01T00:00:00Z") }),
    );
  };

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    notifier = new FakeRealtimeNotifier();
    useCase = new RespondToInvitationUseCaseImpl(
      txRepos.sessions,
      txRepos.campaigns,
      txRepos.sessionParticipants,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
      notifier,
    );

    // Campagne "camp-1" (groupe "group-1") + une session en LOBBY + un joueur convié.
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "Ma campagne", "group-1"));
    txRepos.sessions.seed(buildTestSession("sess-1", "camp-1").openLobby());
    seedInvitation("sess-1", "player-2");
  });

  it("accepte l'invitation (INVITED → ACCEPTED) et notifie le groupe", async () => {
    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "player-2",
      accept: true,
    });

    expect(result.isSuccess).toBe(true);
    const stored = await txRepos.sessionParticipants.findBySessionIdAndUserId("sess-1", "player-2");
    expect(stored!.status.value).toBe("ACCEPTED");
    expect(stored!.respondedAt).not.toBeNull();
    // Le lobby du MJ est rafraîchi via le canal du groupe.
    expect(notifier.notifications).toContainEqual({
      kind: "group",
      id: "group-1",
      resource: "session-participants",
    });
  });

  it("refuse l'invitation (INVITED → REFUSED)", async () => {
    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "player-2",
      accept: false,
    });

    expect(result.isSuccess).toBe(true);
    const stored = await txRepos.sessionParticipants.findBySessionIdAndUserId("sess-1", "player-2");
    expect(stored!.status.value).toBe("REFUSED");
  });

  it("échoue (SESSION_NOT_FOUND) si la session n'existe pas", async () => {
    const result = await useCase.execute({
      sessionId: "ghost",
      actorUserId: "player-2",
      accept: true,
    });

    expect(result.error).toBeInstanceOf(SessionNotFoundError);
  });

  it("échoue (CAMPAIGN_NOT_FOUND) si la campagne parente a disparu", async () => {
    txRepos.sessions.seed(buildTestSession("orpheline", "campagne-fantome").openLobby());

    const result = await useCase.execute({
      sessionId: "orpheline",
      actorUserId: "player-2",
      accept: true,
    });

    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue (SESSION_NOT_JOINABLE) si la session n'est pas en lobby", async () => {
    // Session encore PLANNED (lobby pas ouvert).
    txRepos.sessions.seed(buildTestSession("planifiee", "camp-1"));

    const result = await useCase.execute({
      sessionId: "planifiee",
      actorUserId: "player-2",
      accept: true,
    });

    expect(result.error).toBeInstanceOf(SessionNotJoinableError);
  });

  it("échoue (PARTICIPANT_NOT_FOUND) si le demandeur n'a pas été convié", async () => {
    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "intrus",
      accept: true,
    });

    expect(result.error).toBeInstanceOf(ParticipantNotFoundError);
  });

  it("échoue (PARTICIPANT_ALREADY_RESPONDED) si le joueur a déjà répondu", async () => {
    // Première réponse : acceptée.
    await useCase.execute({ sessionId: "sess-1", actorUserId: "player-2", accept: true });

    // Seconde tentative : rejetée par l'invariant du domaine.
    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "player-2",
      accept: false,
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("PARTICIPANT_ALREADY_RESPONDED");
  });
});
