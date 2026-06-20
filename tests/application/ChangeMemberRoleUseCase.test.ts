import { describe, it, expect, beforeEach } from "vitest";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { ChangeMemberRoleUseCaseImpl } from "@application/features/friend-group/usecases/ChangeMemberRoleUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import {
  buildFakeTransactionalRepositories,
  FakeUnitOfWork,
  FakeLogger,
  buildTestMembership,
} from "./fakes";

/**
 * Couvre la gestion des privilèges de groupe (promotion / rétrogradation admin), du code de
 * sécurité jusque-là non testé : exigence d'admin, cible membre, protection du dernier admin
 * et validation du rôle. Calqué sur RemoveMemberUseCase (mêmes dépendances).
 */
describe("ChangeMemberRoleUseCase", () => {
  let repos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: ChangeMemberRoleUseCaseImpl;

  beforeEach(() => {
    repos = buildFakeTransactionalRepositories();
    const accessService = new GroupAccessServiceImpl(
      repos.groupMembers,
      repos.campaigns,
      repos.campaignCharacters,
    );
    useCase = new ChangeMemberRoleUseCaseImpl(
      repos.groupMembers,
      accessService,
      new FakeUnitOfWork(repos),
      new FakeLogger(),
    );
  });

  it("promeut un membre en admin", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "user-2", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "user-1",
      targetUserId: "user-2",
      newRole: "ADMIN",
    });

    expect(result.isSuccess).toBe(true);
    const updated = await repos.groupMembers.findByUserIdAndGroupId("user-2", "group-1");
    expect(updated?.role.value).toBe("ADMIN");
  });

  it("rétrograde un admin en membre tant qu'il en reste un autre", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "user-2", role: GroupRole.ADMIN }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "user-1",
      targetUserId: "user-2",
      newRole: "MEMBER",
    });

    expect(result.isSuccess).toBe(true);
    const updated = await repos.groupMembers.findByUserIdAndGroupId("user-2", "group-1");
    expect(updated?.role.value).toBe("MEMBER");
  });

  it("refuse si l'acteur n'est pas admin", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.MEMBER }));
    repos.groupMembers.seed(buildTestMembership({ userId: "user-2", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "user-1",
      targetUserId: "user-2",
      newRole: "ADMIN",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_ADMIN");
    // L'état n'a pas changé.
    const target = await repos.groupMembers.findByUserIdAndGroupId("user-2", "group-1");
    expect(target?.role.value).toBe("MEMBER");
  });

  it("refuse si la cible n'est pas membre du groupe", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "user-1",
      targetUserId: "user-inconnu",
      newRole: "ADMIN",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_MEMBER");
  });

  it("empêche de rétrograder le dernier admin", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "user-2", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "user-1",
      targetUserId: "user-1",
      newRole: "MEMBER",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("CANNOT_REMOVE_LAST_ADMIN");
    // L'admin reste admin.
    const self = await repos.groupMembers.findByUserIdAndGroupId("user-1", "group-1");
    expect(self?.role.value).toBe("ADMIN");
  });

  it("rejette un rôle invalide", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "user-2", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "user-1",
      targetUserId: "user-2",
      newRole: "SUPER_ADMIN",
    });

    // Un rôle inconnu est une entrée invalide : INVALID_GROUP_ROLE (→ 400), pas NOT_GROUP_MEMBER (403).
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("INVALID_GROUP_ROLE");
    // Aucune modification de rôle malgré l'entrée invalide.
    const target = await repos.groupMembers.findByUserIdAndGroupId("user-2", "group-1");
    expect(target?.role.value).toBe("MEMBER");
  });

  it("promeut un membre en MJ", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));
    repos.groupMembers.seed(buildTestMembership({ userId: "user-2", role: GroupRole.MEMBER }));

    const result = await useCase.execute({
      groupId: "group-1",
      actorId: "user-1",
      targetUserId: "user-2",
      newRole: "MJ",
    });

    expect(result.isSuccess).toBe(true);
    const updated = await repos.groupMembers.findByUserIdAndGroupId("user-2", "group-1");
    expect(updated?.role.value).toBe("MJ");
  });
});
