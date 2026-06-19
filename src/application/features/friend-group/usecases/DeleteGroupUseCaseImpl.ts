import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { FriendGroupRepository } from "@application/features/friend-group/abstractions/repositories/FriendGroupRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { GroupNotFoundError } from "@application/features/friend-group/errors/GroupNotFoundError";
import { GroupHasResourcesError } from "@application/features/friend-group/errors/GroupHasResourcesError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { DeleteGroupUseCase } from "@application/features/friend-group/abstractions/usecases/DeleteGroupUseCase";

export class DeleteGroupUseCaseImpl implements DeleteGroupUseCase {
  constructor(
    private readonly friendGroupRepository: FriendGroupRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly groupAccessService: GroupAccessService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(params: {
    groupId: string;
    userId: string;
  }): Promise<Result<void, AppError>> {
    const accessResult = await this.groupAccessService.requireAdmin(params.userId, params.groupId);
    if (accessResult.isFailure) return Result.failure(accessResult.error);

    const group = await this.friendGroupRepository.findById(params.groupId);
    if (group === null) return Result.failure(new GroupNotFoundError());

    if (await this.campaignRepository.existsByGroupId(params.groupId)) {
      return Result.failure(new GroupHasResourcesError());
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.friendGroups.deleteById(params.groupId);
    });

    this.logger.info("Groupe supprimé", { groupId: params.groupId, by: params.userId });
    return Result.success(undefined);
  }
}
