import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import { NotGroupAdminError } from "@application/features/friend-group/errors/NotGroupAdminError";

export class GroupAccessServiceImpl implements GroupAccessService {
  constructor(
    private readonly groupMemberRepository: GroupMemberRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly campaignCharacterRepository: CampaignCharacterRepository,
  ) {}

  public async requireMember(userId: string, groupId: string): Promise<Result<void, AppError>> {
    const membership = await this.groupMemberRepository.findByUserIdAndGroupId(userId, groupId);
    if (membership === null) {
      return Result.failure(new NotGroupMemberError());
    }
    return Result.success(undefined);
  }

  public async requireAdmin(userId: string, groupId: string): Promise<Result<void, AppError>> {
    const membership = await this.groupMemberRepository.findByUserIdAndGroupId(userId, groupId);
    if (membership === null) {
      return Result.failure(new NotGroupMemberError());
    }
    if (!membership.isAdmin()) {
      return Result.failure(new NotGroupAdminError());
    }
    return Result.success(undefined);
  }

  public async isGameMasterOfSheetCampaign(userId: string, sheetId: string): Promise<boolean> {
    const views = await this.campaignCharacterRepository.findCampaignViewsBySheetId(sheetId);
    for (const view of views) {
      const campaign = await this.campaignRepository.findById(view.campaignId);
      if (campaign !== null && campaign.isGameMaster(userId)) {
        return true;
      }
    }
    return false;
  }
}
