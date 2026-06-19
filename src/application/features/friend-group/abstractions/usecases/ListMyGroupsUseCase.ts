import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";

export interface MyGroupView {
  id: string;
  name: string;
  createdAt: Date;
  myRole: string;
}

export interface ListMyGroupsUseCase {
  execute(params: { userId: string }): Promise<Result<MyGroupView[], AppError>>;
}
