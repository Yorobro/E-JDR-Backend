import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import { NotGroupAdminError } from "@application/features/friend-group/errors/NotGroupAdminError";
import { NotGroupEditorError } from "@application/features/friend-group/errors/NotGroupEditorError";

export class GroupAccessServiceImpl implements GroupAccessService {
  constructor(
    private readonly groupMemberRepository: GroupMemberRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly characterSheetRepository: CharacterSheetRepository,
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

  public async requireEditor(userId: string, groupId: string): Promise<Result<void, AppError>> {
    const membership = await this.groupMemberRepository.findByUserIdAndGroupId(userId, groupId);
    if (membership === null) {
      return Result.failure(new NotGroupMemberError());
    }
    if (!membership.isEditor()) {
      return Result.failure(new NotGroupEditorError());
    }
    return Result.success(undefined);
  }

  public async isGameMasterOfSheetCampaign(userId: string, sheetId: string): Promise<boolean> {
    // Modèle « une fiche = une campagne » : la fiche porte directement sa campagne.
    const sheet = await this.characterSheetRepository.findById(sheetId);
    if (sheet === null) {
      return false;
    }
    const campaign = await this.campaignRepository.findById(sheet.campaignId);
    return campaign !== null && campaign.isGameMaster(userId);
  }
}
