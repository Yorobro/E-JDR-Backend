import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";

export interface ChangeMemberRoleUseCase {
  execute(params: {
    groupId: string;
    actorId: string;
    targetUserId: string;
    newRole: string;
  }): Promise<Result<void, AppError>>;
}
