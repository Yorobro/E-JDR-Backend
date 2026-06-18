import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";

export interface GroupMemberView {
  userId: string;
  role: string;
  createdAt: Date;
}

export interface GetGroupResult {
  id: string;
  name: string;
  createdAt: Date;
  members: GroupMemberView[];
  myRole: string;
}

export interface GetGroupUseCase {
  execute(params: { groupId: string; userId: string }): Promise<Result<GetGroupResult, AppError>>;
}
