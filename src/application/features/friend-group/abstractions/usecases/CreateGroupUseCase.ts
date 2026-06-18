import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";

export interface CreateGroupCommand {
  createdBy: string;
  name: string;
}

export interface CreateGroupResult {
  id: string;
  name: string;
  createdAt: Date;
}

export interface CreateGroupUseCase {
  execute(command: CreateGroupCommand): Promise<Result<CreateGroupResult, AppError>>;
}
