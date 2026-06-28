import { describe, it, expect, beforeEach } from "vitest";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { InvitationStatus } from "@domain/features/friend-group/value-objects/InvitationStatus";
import { AcceptInvitationUseCaseImpl } from "@application/features/friend-group/usecases/AcceptInvitationUseCaseImpl";
import { DeclineInvitationUseCaseImpl } from "@application/features/friend-group/usecases/DeclineInvitationUseCaseImpl";
import { RemoveMemberUseCaseImpl } from "@application/features/friend-group/usecases/RemoveMemberUseCaseImpl";
import { InviteMemberUseCaseImpl } from "@application/features/friend-group/usecases/InviteMemberUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import {
  buildFakeTransactionalRepositories,
  FakeUnitOfWork,
  FakeLogger,
  FakeIdGenerator,
  buildTestFriendGroup,
  buildTestMembership,
  buildTestInvitation,
  buildTestCredential,
} from "./fakes";

describe("AcceptInvitationUseCase", () => {
  let repos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: AcceptInvitationUseCaseImpl;

  beforeEach(() => {
    repos = buildFakeTransactionalRepositories();
    useCase = new AcceptInvitationUseCaseImpl(
      repos.groupInvitations,
      new FakeUnitOfWork(repos),
      new FakeLogger(),
    );
  });

  it("accepte une invitation valide et crée le membership", async () => {
    const inv = buildTestInvitation({ invitedUserId: "user-2" });
    repos.groupInvitations.seed(inv);

    const result = await useCase.execute({ invitationId: "inv-1", userId: "user-2" });

    expect(result.isSuccess).toBe(true);
    const updated = await repos.groupInvitations.findById("inv-1");
    expect(updated?.status.value).toBe("ACCEPTED");
    const membership = await repos.groupMembers.findByUserIdAndGroupId("user-2", "group-1");
    expect(membership?.role.value).toBe("MEMBER");
  });

  it("échoue si l'invitation est introuvable", async () => {
    const result = await useCase.execute({ invitationId: "unknown", userId: "user-2" });
    expect(result.error.code).toBe("INVITATION_NOT_FOUND");
  });

  it("échoue si l'utilisateur n'est pas l'invité", async () => {
    repos.groupInvitations.seed(buildTestInvitation({ invitedUserId: "user-2" }));
    const result = await useCase.execute({ invitationId: "inv-1", userId: "user-3" });
    expect(result.error.code).toBe("NOT_GROUP_MEMBER");
  });

  it("échoue si l'invitation est déjà résolue", async () => {
    repos.groupInvitations.seed(
      buildTestInvitation({ invitedUserId: "user-2", status: InvitationStatus.ACCEPTED }),
    );
    const result = await useCase.execute({ invitationId: "inv-1", userId: "user-2" });
    expect(result.error.code).toBe("INVITATION_ALREADY_RESOLVED");
  });
});

describe("DeclineInvitationUseCase", () => {
  let repos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: DeclineInvitationUseCaseImpl;

  beforeEach(() => {
    repos = buildFakeTransactionalRepositories();
    useCase = new DeclineInvitationUseCaseImpl(
      repos.groupInvitations,
      new FakeUnitOfWork(repos),
      new FakeLogger(),
    );
  });

  it("refuse une invitation valide", async () => {
    repos.groupInvitations.seed(buildTestInvitation({ invitedUserId: "user-2" }));

    const result = await useCase.execute({ invitationId: "inv-1", userId: "user-2" });

    expect(result.isSuccess).toBe(true);
    const updated = await repos.groupInvitations.findById("inv-1");
    expect(updated?.status.value).toBe("DECLINED");
  });
});

describe("RemoveMemberUseCase", () => {
  let repos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: RemoveMemberUseCaseImpl;

  beforeEach(() => {
    repos = buildFakeTransactionalRepositories();
    const accessService = new GroupAccessServiceImpl(
      repos.groupMembers,
      repos.campaigns,
      repos.characterSheets,
    );
    useCase = new RemoveMemberUseCaseImpl(
      repos.groupMembers,
      accessService,
      new FakeUnitOfWork(repos),
      new FakeLogger(),
    );
  });

  it("retire un membre non-admin", async () => {
    repos.friendGroups.seed(buildTestFriendGroup());
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "user-2", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "user-1",
      targetUserId: "user-2",
    });

    expect(result.isSuccess).toBe(true);
    const membership = await repos.groupMembers.findByUserIdAndGroupId("user-2", "group-1");
    expect(membership).toBeNull();
  });

  it("empêche de retirer le dernier admin", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "user-1",
      targetUserId: "user-1",
    });

    expect(result.error.code).toBe("CANNOT_REMOVE_LAST_ADMIN");
  });

  it("échoue si l'acteur n'est pas membre", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "user-2", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "non-membre",
      targetUserId: "user-2",
    });

    expect(result.error.code).toBe("NOT_GROUP_MEMBER");
  });
});

describe("InviteMemberUseCase — réinvitation après résolution", () => {
  let repos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: InviteMemberUseCaseImpl;

  beforeEach(() => {
    repos = buildFakeTransactionalRepositories();
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));
    // L'invité (user-2) doit avoir un compte (anti-énumération → 404 sinon).
    repos.credentials.seed(buildTestCredential("invite@test.com", "pwd", "user-2", "cred-2"));
    const accessService = new GroupAccessServiceImpl(
      repos.groupMembers,
      repos.campaigns,
      repos.characterSheets,
    );
    useCase = new InviteMemberUseCaseImpl({
      credentialRepository: repos.credentials,
      groupMemberRepository: repos.groupMembers,
      groupInvitationRepository: repos.groupInvitations,
      groupAccessService: accessService,
      idGenerator: new FakeIdGenerator(),
      unitOfWork: new FakeUnitOfWork(repos),
      logger: new FakeLogger(),
    });
  });

  it("autorise la réinvitation quand une invitation DECLINED existe déjà pour ce couple", async () => {
    // Une invitation résolue (refusée) traîne en base pour (group-1, user-2).
    repos.groupInvitations.seed(
      buildTestInvitation({
        id: "old-inv",
        invitedUserId: "user-2",
        status: InvitationStatus.DECLINED,
      }),
    );

    const result = await useCase.execute({
      groupId: "group-1",
      invitedByUserId: "user-1",
      inviteeEmail: "invite@test.com",
    });

    // La réinvitation doit réussir (l'ancienne ligne résolue ne doit pas bloquer l'INSERT).
    expect(result.isSuccess).toBe(true);
    const pending = await repos.groupInvitations.findPendingByGroupAndUser("group-1", "user-2");
    expect(pending).not.toBeNull();
    // L'ancienne invitation résolue a été supprimée (pas d'accumulation / pas de violation d'unicité).
    expect(await repos.groupInvitations.findById("old-inv")).toBeNull();
  });

  it("refuse une nouvelle invitation s'il existe déjà une invitation PENDING", async () => {
    repos.groupInvitations.seed(
      buildTestInvitation({
        id: "pending-inv",
        invitedUserId: "user-2",
        status: InvitationStatus.PENDING,
      }),
    );

    const result = await useCase.execute({
      groupId: "group-1",
      invitedByUserId: "user-1",
      inviteeEmail: "invite@test.com",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("INVITATION_ALREADY_PENDING");
  });
});
