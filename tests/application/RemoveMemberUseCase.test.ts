import { describe, it, expect, beforeEach } from "vitest";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { RemoveMemberUseCaseImpl } from "@application/features/friend-group/usecases/RemoveMemberUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import {
  buildFakeTransactionalRepositories,
  FakeUnitOfWork,
  FakeLogger,
  buildTestMembership,
} from "./fakes";

/**
 * Distinction métier au retrait d'un membre :
 * - **Quitter** (l'acteur se retire lui-même) : autorisé pour tout membre, quel que soit son rôle,
 *   sous réserve de ne pas être le dernier admin.
 * - **Retirer autrui** : réservé aux admins du groupe (NOT_GROUP_ADMIN sinon).
 */
describe("RemoveMemberUseCase", () => {
  let repos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: RemoveMemberUseCaseImpl;

  beforeEach(() => {
    repos = buildFakeTransactionalRepositories();
    const accessService = new GroupAccessServiceImpl(
      repos.groupMembers,
      repos.campaigns,
      repos.campaignCharacters,
    );
    useCase = new RemoveMemberUseCaseImpl(
      repos.groupMembers,
      accessService,
      new FakeUnitOfWork(repos),
      new FakeLogger(),
    );
  });

  it("permet à un simple membre de se retirer lui-même (quitter)", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "admin-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "player-1", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "player-1",
      targetUserId: "player-1",
    });

    expect(result.isSuccess).toBe(true);
    expect(await repos.groupMembers.findByUserIdAndGroupId("player-1", "group-1")).toBeNull();
  });

  it("permet à un MJ de quitter le groupe", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "admin-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "mj-1", role: GroupRole.MJ }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "mj-1",
      targetUserId: "mj-1",
    });

    expect(result.isSuccess).toBe(true);
  });

  it("interdit à un simple membre de retirer un autre membre (NOT_GROUP_ADMIN)", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "admin-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "player-1", role: GroupRole.MEMBER }));
    repos.groupMembers.seed(buildTestMembership({ userId: "player-2", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "player-1",
      targetUserId: "player-2",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_ADMIN");
    // La cible ne doit PAS avoir été retirée.
    expect(await repos.groupMembers.findByUserIdAndGroupId("player-2", "group-1")).not.toBeNull();
  });

  it("interdit à un MJ de retirer un autre membre (gestion réservée à l'admin)", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "admin-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "mj-1", role: GroupRole.MJ }));
    repos.groupMembers.seed(buildTestMembership({ userId: "player-1", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "mj-1",
      targetUserId: "player-1",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_ADMIN");
  });

  it("permet à un admin de retirer un autre membre", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "admin-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "player-1", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "admin-1",
      targetUserId: "player-1",
    });

    expect(result.isSuccess).toBe(true);
    expect(await repos.groupMembers.findByUserIdAndGroupId("player-1", "group-1")).toBeNull();
  });

  it("empêche le dernier admin de quitter le groupe (CANNOT_REMOVE_LAST_ADMIN)", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "admin-1", role: GroupRole.ADMIN }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "admin-1",
      targetUserId: "admin-1",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("CANNOT_REMOVE_LAST_ADMIN");
  });

  it("rejette un acteur non membre du groupe (NOT_GROUP_MEMBER)", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "admin-1", role: GroupRole.ADMIN }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "etranger-1",
      targetUserId: "etranger-1",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_MEMBER");
  });
});
