import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { SheetReferenceLinkRepository } from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { CopyCharacterSheetCommand } from "@application/features/character-sheet/commands/CopyCharacterSheetCommand";
import {
  CopyCharacterSheetUseCase,
  CopyCharacterSheetResult,
} from "@application/features/character-sheet/abstractions/usecases/CopyCharacterSheetUseCase";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { GameMasterCannotJoinOwnCampaignError } from "@application/features/character-sheet/errors/GameMasterCannotJoinOwnCampaignError";

/** Repos de lecture des liaisons N‑N fiche ↔ éléments de référence (pour dupliquer la source). */
export interface CopyCharacterSheetLinkRepositories {
  readonly armes: SheetReferenceLinkRepository;
  readonly armures: SheetReferenceLinkRepository;
  readonly competences: SheetReferenceLinkRepository;
  readonly equipements: SheetReferenceLinkRepository;
  readonly sorts: SheetReferenceLinkRepository;
  readonly miracles: SheetReferenceLinkRepository;
}

/**
 * Dépendances du use case de copie de fiche (regroupées dans un objet pour rester sous la limite
 * de paramètres de constructeur `ejdr/parameter-count`).
 */
export interface CopyCharacterSheetDeps {
  readonly idGenerator: IdGeneratorService;
  readonly campaignRepository: CampaignRepository;
  readonly characterSheetRepository: CharacterSheetRepository;
  /** Liaisons N‑N de la fiche source à dupliquer (une par type liable). */
  readonly sourceLinks: CopyCharacterSheetLinkRepositories;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
  readonly realtimeNotifier: RealtimeNotifier;
}

/**
 * Use case « copier une fiche vers une autre campagne ».
 *
 * Remplace l'ancien « rattacher une même fiche à plusieurs campagnes » (N‑N abandonné). Duplique
 * tous les champs/stats de la fiche source **et ses liaisons N‑N** (armes/armures/compétences/
 * équipements/sorts/miracles) vers une **nouvelle fiche** (nouvel id), rattachée à la campagne
 * cible en statut **PENDING**.
 *
 * Règles : l'acteur doit être **propriétaire** de la source ; la campagne cible doit exister,
 * appartenir au **même groupe** que la fiche, et l'acteur ne doit **pas en être le MJ**.
 */
export class CopyCharacterSheetUseCaseImpl implements CopyCharacterSheetUseCase {
  private readonly idGenerator: IdGeneratorService;
  private readonly campaignRepository: CampaignRepository;
  private readonly characterSheetRepository: CharacterSheetRepository;
  private readonly sourceLinks: CopyCharacterSheetLinkRepositories;
  private readonly unitOfWork: UnitOfWork;
  private readonly logger: Logger;
  private readonly realtimeNotifier: RealtimeNotifier;

  constructor(deps: CopyCharacterSheetDeps) {
    this.idGenerator = deps.idGenerator;
    this.campaignRepository = deps.campaignRepository;
    this.characterSheetRepository = deps.characterSheetRepository;
    this.sourceLinks = deps.sourceLinks;
    this.unitOfWork = deps.unitOfWork;
    this.logger = deps.logger;
    this.realtimeNotifier = deps.realtimeNotifier;
  }

  public async execute(
    command: CopyCharacterSheetCommand,
  ): Promise<Result<CopyCharacterSheetResult, AppError>> {
    const source = await this.characterSheetRepository.findById(command.sourceSheetId);
    if (source === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    // Seul le propriétaire peut copier sa fiche.
    if (!source.isOwnedBy(command.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const targetCampaign = await this.campaignRepository.findById(command.targetCampaignId);
    if (targetCampaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    // La copie reste dans le même groupe que la fiche source.
    if (!source.isInGroup(targetCampaign.groupId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    // Le MJ ne peut pas être joueur de sa propre campagne.
    if (targetCampaign.isGameMaster(command.actorUserId)) {
      return Result.failure(new GameMasterCannotJoinOwnCampaignError());
    }

    const newId = this.idGenerator.generate();
    const copy = source.copyTo(newId, targetCampaign.id, new Date());

    // Lit les éléments liés à la source (hors transaction) pour les recopier vers la nouvelle fiche.
    const [armes, armures, competences, equipements, sorts, miracles] = await Promise.all([
      this.sourceLinks.armes.findItemsBySheet(source.id),
      this.sourceLinks.armures.findItemsBySheet(source.id),
      this.sourceLinks.competences.findItemsBySheet(source.id),
      this.sourceLinks.equipements.findItemsBySheet(source.id),
      this.sourceLinks.sorts.findItemsBySheet(source.id),
      this.sourceLinks.miracles.findItemsBySheet(source.id),
    ]);

    await this.unitOfWork.execute(async (repos) => {
      await repos.characterSheets.save(copy);
      const now = new Date();
      await Promise.all([
        ...armes.map((item) => repos.sheetArmes.link(newId, item.id, now)),
        ...armures.map((item) => repos.sheetArmures.link(newId, item.id, now)),
        ...competences.map((item) => repos.sheetCompetences.link(newId, item.id, now)),
        ...equipements.map((item) => repos.sheetEquipements.link(newId, item.id, now)),
        ...sorts.map((item) => repos.sheetSorts.link(newId, item.id, now)),
        ...miracles.map((item) => repos.sheetMiracles.link(newId, item.id, now)),
      ]);
    });

    this.logger.info("Fiche copiée vers une autre campagne (en attente de validation MJ)", {
      sourceSheetId: source.id,
      newSheetId: newId,
      targetCampaignId: targetCampaign.id,
    });

    this.realtimeNotifier.notifyUserChanged(command.actorUserId, "character-sheets");
    this.realtimeNotifier.notifyUserChanged(
      targetCampaign.gameMasterId,
      "campaign-pending-characters",
    );

    return Result.success({
      id: copy.id,
      ownerId: copy.ownerId,
      name: copy.name.value,
      createdAt: copy.createdAt,
    });
  }
}
