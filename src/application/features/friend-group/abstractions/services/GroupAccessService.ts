import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";

export interface GroupAccessService {
  requireMember(userId: string, groupId: string): Promise<Result<void, AppError>>;
  requireAdmin(userId: string, groupId: string): Promise<Result<void, AppError>>;
}
