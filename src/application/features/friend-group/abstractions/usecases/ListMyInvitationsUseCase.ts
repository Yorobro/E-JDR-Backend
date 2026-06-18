import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";
import { PendingInvitationView } from "@application/features/friend-group/abstractions/repositories/GroupInvitationRepository";

export interface ListMyInvitationsUseCase {
  execute(params: { userId: string }): Promise<Result<PendingInvitationView[], AppError>>;
}
