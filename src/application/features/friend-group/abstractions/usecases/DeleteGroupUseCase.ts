import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";

export interface DeleteGroupUseCase {
  execute(params: { groupId: string; userId: string }): Promise<Result<void, AppError>>;
}
