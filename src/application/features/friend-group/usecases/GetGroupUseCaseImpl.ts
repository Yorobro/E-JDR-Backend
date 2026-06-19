import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { FriendGroupRepository } from "@application/features/friend-group/abstractions/repositories/FriendGroupRepository";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { GroupNotFoundError } from "@application/features/friend-group/errors/GroupNotFoundError";
import {
  GetGroupUseCase,
  GetGroupResult,
} from "@application/features/friend-group/abstractions/usecases/GetGroupUseCase";

export class GetGroupUseCaseImpl implements GetGroupUseCase {
  constructor(
    private readonly friendGroupRepository: FriendGroupRepository,
    private readonly groupMemberRepository: GroupMemberRepository,
    private readonly groupAccessService: GroupAccessService,
  ) {}

  public async execute(params: {
    groupId: string;
    userId: string;
  }): Promise<Result<GetGroupResult, AppError>> {
    const accessResult = await this.groupAccessService.requireMember(params.userId, params.groupId);
    if (accessResult.isFailure) return Result.failure(accessResult.error);

    const group = await this.friendGroupRepository.findById(params.groupId);
    if (group === null) return Result.failure(new GroupNotFoundError());

    const members = await this.groupMemberRepository.findViewsByGroupId(params.groupId);
    const myMembership = members.find((m) => m.userId === params.userId);

    return Result.success({
      id: group.id,
      name: group.name.value,
      createdAt: group.createdAt,
      members: members.map((m) => ({
        userId: m.userId,
        pseudo: m.pseudo,
        role: m.role,
        createdAt: m.createdAt,
      })),
      myRole: myMembership?.role ?? "MEMBER",
    });
  }
}
