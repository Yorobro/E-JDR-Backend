import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { FriendGroupRepository } from "@application/features/friend-group/abstractions/repositories/FriendGroupRepository";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import {
  ListMyGroupsUseCase,
  MyGroupView,
} from "@application/features/friend-group/abstractions/usecases/ListMyGroupsUseCase";

export class ListMyGroupsUseCaseImpl implements ListMyGroupsUseCase {
  constructor(
    private readonly friendGroupRepository: FriendGroupRepository,
    private readonly groupMemberRepository: GroupMemberRepository,
  ) {}

  public async execute(params: { userId: string }): Promise<Result<MyGroupView[], AppError>> {
    const groups = await this.friendGroupRepository.findByMemberId(params.userId);

    const views: MyGroupView[] = [];
    for (const group of groups) {
      const membership = await this.groupMemberRepository.findByUserIdAndGroupId(
        params.userId,
        group.id,
      );
      views.push({
        id: group.id,
        name: group.name.value,
        createdAt: group.createdAt,
        myRole: membership?.role.value ?? "MEMBER",
      });
    }

    return Result.success(views);
  }
}
