import { describe, it, expect, beforeEach } from "vitest";
import { CreateLobbyUseCaseImpl } from "@application/features/session/usecases/CreateLobbyUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { NotGroupEditorError } from "@application/features/friend-group/errors/NotGroupEditorError";
import { EmptyParticipantSelectionError } from "@application/features/session/errors/EmptyParticipantSelectionError";
import { ParticipantNotInGroupError } from "@application/features/session/errors/ParticipantNotInGroupError";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestSession,
  buildTestMembership,
} from "./fakes";

describe("CreateLobbyUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: CreateLobbyUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    useCase = new CreateLobbyUseCaseImpl(
      txRepos.sessions,
      txRepos.campaigns,
      txRepos.groupMembers,
      groupAccessService,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );

    // Campagne "camp-1" (groupe "group-1") + une session PLANNED rattachée.
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "Ma campagne", "group-1"));
    txRepos.sessions.seed(buildTestSession("sess-1", "camp-1"));
    // Le MJ (éditeur) et deux joueurs membres.
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.MJ }),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "player-2", role: GroupRole.MEMBER }),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "player-3", role: GroupRole.MEMBER }),
    );
  });

  it("ouvre le lobby et invite les joueurs choisis (membres du groupe)", async () => {
    const result = await useCase.execute({
      sessionId: "sess-1",
      actorUserId: "mj-1",
      participantUserIds: ["player-2", "player-3"],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe("LOBBY");
    expect(result.value.participants).toHaveLength(2);
    expect(result.value.participants.every((p) => p.status === "INVITED")).toBe(true);
    expect(result.value.participants.every((p) => p.characterSheetId === null)).toBe(true);

    // La session est persistée au statut LOBBY...
    const stored = await txRepos.sessions.findById("sess-1");
    expect(stored!.status.value).toBe("LOBBY");
    // ...et les invitations sont enregistrées.
    const invited = await txRepos.sessionParticipants.findBySessionId("sess-1");
    expect(invited.map((p) => p.userId).sort()).toEqual(["player-2", "player-3"]);
  });

  it("dédoublonne la sélection (même joueur coché deux fois ⇒ une seule invitation)", async () => {
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
    txRepos.sessions.seed(buildTestSession("orpheline", "campagne-fantome"));

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

  it("échoue (SESSION_NOT_LAUNCHABLE) si le lobby est déjà ouvert", async () => {
    // Session déjà passée en LOBBY.
    txRepos.sessions.seed(buildTestSession("deja-lobby", "camp-1").openLobby());

    const result = await useCase.execute({
      sessionId: "deja-lobby",
      actorUserId: "mj-1",
      participantUserIds: ["player-2"],
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("SESSION_NOT_LAUNCHABLE");
  });
});
