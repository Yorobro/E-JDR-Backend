import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CreateCharacterSheetCommand } from "@application/features/character-sheet/commands/CreateCharacterSheetCommand";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { GameMasterCannotJoinOwnCampaignError } from "@application/features/character-sheet/errors/GameMasterCannotJoinOwnCampaignError";
import {
  CreateCharacterSheetUseCase,
  CreateCharacterSheetResult,
} from "@application/features/character-sheet/abstractions/usecases/CreateCharacterSheetUseCase";

/**
 * Use case de création d'une fiche de personnage **rattachée à une campagne** (modèle « une fiche
 * = une campagne »).
 *
 * Orchestration pure :
 * 1. l'utilisateur doit être **membre** du groupe ;
 * 2. la campagne choisie doit **exister** et appartenir au **même groupe** que la fiche ;
 * 3. le propriétaire ne doit **pas être le MJ** de cette campagne (le MJ ne joue pas chez lui) ;
 * 4. la fiche est créée en statut **PENDING** (en attente de validation du MJ).
 */
export class CreateCharacterSheetUseCaseImpl implements CreateCharacterSheetUseCase {
  constructor(
    private readonly idGenerator: IdGeneratorService,
    private readonly campaignRepository: CampaignRepository,
    private readonly groupAccessService: GroupAccessService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
    private readonly realtimeNotifier: RealtimeNotifier,
  ) {}

  public async execute(
    command: CreateCharacterSheetCommand,
  ): Promise<Result<CreateCharacterSheetResult, AppError>> {
    const memberAccess = await this.groupAccessService.requireMember(
      command.ownerId,
      command.groupId,
    );
    if (memberAccess.isFailure) {
      return Result.failure(memberAccess.error);
    }

    const campaign = await this.campaignRepository.findById(command.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    // La campagne doit appartenir au même groupe que la fiche (on ne pioche que dans son groupe).
    if (campaign.groupId !== command.groupId) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    // Règle métier conservée : le MJ ne peut pas être joueur de sa propre campagne.
    if (campaign.isGameMaster(command.ownerId)) {
      return Result.failure(new GameMasterCannotJoinOwnCampaignError());
    }

    let name: CharacterSheetName;

    try {
      name = CharacterSheetName.create(command.name);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    const sheet = CharacterSheet.create({
      id: this.idGenerator.generate(),
      ownerId: command.ownerId,
      groupId: command.groupId,
      campaignId: command.campaignId,
      name,
      createdAt: new Date(),
    });

    await this.unitOfWork.execute(async (repos) => {
      await repos.characterSheets.save(sheet);
    });

    this.logger.info("Fiche de personnage créée (en attente de validation MJ)", {
      characterSheetId: sheet.id,
      ownerId: sheet.ownerId,
      campaignId: sheet.campaignId,
    });

    // Notifie les autres appareils du propriétaire (« Mes fiches ») et le MJ de la campagne (une
    // demande de rattachement est en attente). Best-effort : n'impacte pas le résultat.
    this.realtimeNotifier.notifyUserChanged(sheet.ownerId, "character-sheets");
    this.realtimeNotifier.notifyUserChanged(campaign.gameMasterId, "campaign-pending-characters");

    return Result.success({
      id: sheet.id,
      ownerId: sheet.ownerId,
      name: sheet.name.value,
      createdAt: sheet.createdAt,
    });
  }
}
