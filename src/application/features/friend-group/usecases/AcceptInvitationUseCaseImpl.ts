import { GroupMembership } from "@domain/features/friend-group/entities/GroupMembership";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { InvitationStatus } from "@domain/features/friend-group/value-objects/InvitationStatus";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { GroupInvitationRepository } from "@application/features/friend-group/abstractions/repositories/GroupInvitationRepository";
import { InvitationNotFoundError } from "@application/features/friend-group/errors/InvitationNotFoundError";
import { InvitationAlreadyResolvedError } from "@application/features/friend-group/errors/InvitationAlreadyResolvedError";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import { AcceptInvitationUseCase } from "@application/features/friend-group/abstractions/usecases/AcceptInvitationUseCase";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";

export class AcceptInvitationUseCaseImpl implements AcceptInvitationUseCase {
  constructor(
    private readonly groupInvitationRepository: GroupInvitationRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
    private readonly realtimeNotifier: RealtimeNotifier,
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

    const membership = GroupMembership.create({
      groupId: invitation.groupId,
      userId: params.userId,
      role: GroupRole.MEMBER,
      createdAt: new Date(),
    });

    await this.unitOfWork.execute(async (repos) => {
      await repos.groupInvitations.updateStatus(invitation.id, InvitationStatus.ACCEPTED);
      await repos.groupMembers.save(membership);
    });

    this.logger.info("Invitation acceptée", {
      invitationId: invitation.id,
      groupId: invitation.groupId,
      userId: params.userId,
    });

    this.realtimeNotifier.notifyGroupChanged(invitation.groupId, "group-members");
    this.realtimeNotifier.notifyUserChanged(params.userId, "my-groups");

    return Result.success(undefined);
  }
}
