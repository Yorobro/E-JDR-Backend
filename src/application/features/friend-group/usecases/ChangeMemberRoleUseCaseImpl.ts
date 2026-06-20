import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { tryCreateValueObject } from "@application/shared/tryCreateValueObject";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import { CannotRemoveLastAdminError } from "@application/features/friend-group/errors/CannotRemoveLastAdminError";
import { ChangeMemberRoleUseCase } from "@application/features/friend-group/abstractions/usecases/ChangeMemberRoleUseCase";

export class ChangeMemberRoleUseCaseImpl implements ChangeMemberRoleUseCase {
  constructor(
    private readonly groupMemberRepository: GroupMemberRepository,
    private readonly groupAccessService: GroupAccessService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(params: {
    groupId: string;
    actorId: string;
    targetUserId: string;
    newRole: string;
  }): Promise<Result<void, AppError>> {
    const actorAccess = await this.groupAccessService.requireAdmin(params.actorId, params.groupId);
    if (actorAccess.isFailure) return Result.failure(actorAccess.error);

    const targetMembership = await this.groupMemberRepository.findByUserIdAndGroupId(
      params.targetUserId,
      params.groupId,
    );
    if (targetMembership === null) return Result.failure(new NotGroupMemberError());

    // Un rôle inconnu est une entrée invalide (→ 400 INVALID_GROUP_ROLE), pas un « non-membre ».
    const newRoleResult = tryCreateValueObject(() => GroupRole.create(params.newRole));
    if (newRoleResult.isFailure) return Result.failure(newRoleResult.error);
    const newRole: GroupRole = newRoleResult.value;

    if (targetMembership.isAdmin() && !newRole.isAdmin()) {
      const adminCount = await this.groupMemberRepository.countAdminsByGroupId(params.groupId);
      if (adminCount <= 1) return Result.failure(new CannotRemoveLastAdminError());
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.groupMembers.updateRole(params.targetUserId, params.groupId, newRole);
    });

    this.logger.info("Rôle modifié", {
      groupId: params.groupId,
      targetUserId: params.targetUserId,
      newRole: newRole.value,
      by: params.actorId,
    });

    return Result.success(undefined);
  }
}
