import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";

export interface AcceptInvitationUseCase {
  execute(params: { invitationId: string; userId: string }): Promise<Result<void, AppError>>;
}
