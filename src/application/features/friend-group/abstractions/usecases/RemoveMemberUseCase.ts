import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";

export interface RemoveMemberUseCase {
  execute(params: {
    groupId: string;
    actorId: string;
    targetUserId: string;
  }): Promise<Result<void, AppError>>;
}
