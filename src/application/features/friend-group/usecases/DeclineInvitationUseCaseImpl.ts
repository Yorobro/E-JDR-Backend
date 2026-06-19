import { InvitationStatus } from "@domain/features/friend-group/value-objects/InvitationStatus";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { GroupInvitationRepository } from "@application/features/friend-group/abstractions/repositories/GroupInvitationRepository";
import { InvitationNotFoundError } from "@application/features/friend-group/errors/InvitationNotFoundError";
import { InvitationAlreadyResolvedError } from "@application/features/friend-group/errors/InvitationAlreadyResolvedError";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import { DeclineInvitationUseCase } from "@application/features/friend-group/abstractions/usecases/DeclineInvitationUseCase";

export class DeclineInvitationUseCaseImpl implements DeclineInvitationUseCase {
  constructor(
    private readonly groupInvitationRepository: GroupInvitationRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(params: {
    invitationId: string;
    userId: string;
  }): Promise<Result<void, AppError>> {
    const invitation = await this.groupInvitationRepository.findById(params.invitationId);
    if (invitation === null) return Result.failure(new InvitationNotFoundError());

    if (!invitation.isInvitedUser(params.userId)) {
      return Result.failure(new NotGroupMemberError());
    }

    if (!invitation.isPending()) {
      return Result.failure(new InvitationAlreadyResolvedError());
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.groupInvitations.updateStatus(invitation.id, InvitationStatus.DECLINED);
    });

    this.logger.info("Invitation refusée", {
      invitationId: invitation.id,
      groupId: invitation.groupId,
      userId: params.userId,
    });

    return Result.success(undefined);
  }
}
