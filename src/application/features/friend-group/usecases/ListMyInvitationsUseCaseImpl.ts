import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import {
  GroupInvitationRepository,
  PendingInvitationView,
} from "@application/features/friend-group/abstractions/repositories/GroupInvitationRepository";
import { ListMyInvitationsUseCase } from "@application/features/friend-group/abstractions/usecases/ListMyInvitationsUseCase";

export class ListMyInvitationsUseCaseImpl implements ListMyInvitationsUseCase {
  constructor(private readonly groupInvitationRepository: GroupInvitationRepository) {}

  public async execute(params: {
    userId: string;
  }): Promise<Result<PendingInvitationView[], AppError>> {
    const views = await this.groupInvitationRepository.findPendingViewsByInvitedUser(params.userId);
    return Result.success(views);
  }
}
