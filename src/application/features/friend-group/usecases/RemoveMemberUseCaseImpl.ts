import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import { CannotRemoveLastAdminError } from "@application/features/friend-group/errors/CannotRemoveLastAdminError";
import { CannotRemoveAdminError } from "@application/features/friend-group/errors/CannotRemoveAdminError";
import { RemoveMemberUseCase } from "@application/features/friend-group/abstractions/usecases/RemoveMemberUseCase";

export class RemoveMemberUseCaseImpl implements RemoveMemberUseCase {
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
  }): Promise<Result<void, AppError>> {
    // Deux actions distinctes derrière un même use case :
    // - **Quitter** (l'acteur se retire lui-même) : autorisé à tout membre du groupe.
    // - **Retirer autrui** : action de gestion réservée aux admins.
    const isSelfRemoval = params.actorId === params.targetUserId;
    const actorAccess = isSelfRemoval
      ? await this.groupAccessService.requireMember(params.actorId, params.groupId)
      : await this.groupAccessService.requireAdmin(params.actorId, params.groupId);
    if (actorAccess.isFailure) return Result.failure(actorAccess.error);

    const targetMembership = await this.groupMemberRepository.findByUserIdAndGroupId(
      params.targetUserId,
      params.groupId,
    );
    if (targetMembership === null) return Result.failure(new NotGroupMemberError());

    // Un admin ne peut pas **retirer** un autre admin : seul le retrait de soi-même (quitter) ou
    // des MEMBER/MJ est permis. Pour cesser d'être admin, un admin se rétrograde (ChangeMemberRole)
    // ou quitte le groupe.
    if (!isSelfRemoval && targetMembership.isAdmin()) {
      return Result.failure(new CannotRemoveAdminError());
    }

    // Quitter quand on est le dernier admin reste interdit (le groupe perdrait toute administration).
    if (targetMembership.isAdmin()) {
      const adminCount = await this.groupMemberRepository.countAdminsByGroupId(params.groupId);
      if (adminCount <= 1) return Result.failure(new CannotRemoveLastAdminError());
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.groupMembers.deleteByUserIdAndGroupId(params.targetUserId, params.groupId);
    });

    this.logger.info("Membre retiré", {
      groupId: params.groupId,
      targetUserId: params.targetUserId,
      by: params.actorId,
    });

    return Result.success(undefined);
  }
}
