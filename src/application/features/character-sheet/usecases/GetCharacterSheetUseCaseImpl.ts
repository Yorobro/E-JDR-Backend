import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { GetCharacterSheetQuery } from "@application/features/character-sheet/query/GetCharacterSheetQuery";
import { GetCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/GetCharacterSheetUseCase";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { toCharacterSheetDetail } from "@application/features/character-sheet/usecases/toCharacterSheetDetail";
import { CharacterSheetReferenceResolver } from "@application/features/character-sheet/usecases/CharacterSheetReferenceResolver";
import { computeDerivedCharacterStats } from "@application/features/character-sheet/usecases/computeDerivedCharacterStats";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";
import { SheetReferenceLinkRepository } from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";

/**
 * Dépendances du use case de lecture détaillée d'une fiche (regroupées dans un objet pour rester
 * sous la limite de paramètres de constructeur `ejdr/parameter-count`).
 */
export interface GetCharacterSheetDeps {
  /** Fiches de personnage (lecture). */
  readonly characterSheetRepository: CharacterSheetRepository;
  /** Campagnes (résolution du nom de la campagne de rattachement de la fiche). */
  readonly campaignRepository: CampaignRepository;
  /** Catalogue des formations (résolution du nom + bonus de la formation portée par la fiche). */
  readonly formationRepository: ReferenceRepository;
  /** Catalogue des peuples (résolution du nom + bonus du peuple porté par la fiche). */
  readonly peupleRepository: ReferenceRepository;
  /** Catalogue des compétences (résolution des noms des compétences liées à la formation). */
  readonly competenceRepository: ReferenceRepository;
  /** Liaison formation ↔ compétences (ids des compétences rattachées à la formation). */
  readonly formationCompetenceLink: FormationCompetenceLinkRepository;
  /** Liaison fiche ↔ armures (points de protection liés à la fiche, pour dériver la protection). */
  readonly sheetArmures: SheetReferenceLinkRepository;
  /** Vérifie l'appartenance au groupe de la fiche (visibilité « tout le groupe »). */
  readonly groupAccessService: GroupAccessService;
  /** Journalisation applicative. */
  readonly logger: Logger;
}

/**
 * Use case de consultation détaillée d'une fiche.
 *
 * Charge la fiche, vérifie que le demandeur est **membre du groupe** de la fiche (visibilité
 * « tout le groupe », D10), puis projette la fiche complète. Résout en plus la **formation** et le
 * **peuple** actifs (nom + bonus de stat), et — pour la formation — ses **compétences** liées, afin
 * que le front puisse afficher base + bonus + total et les compétences dérivées. Le bonus n'est
 * **pas** appliqué côté back : les stats de base de la fiche restent inchangées. Lecture pure.
 */
export class GetCharacterSheetUseCaseImpl implements GetCharacterSheetUseCase {
  private readonly characterSheetRepository: CharacterSheetRepository;
  private readonly campaignRepository: CampaignRepository;
  private readonly referenceResolver: CharacterSheetReferenceResolver;
  private readonly sheetArmures: SheetReferenceLinkRepository;
  private readonly groupAccessService: GroupAccessService;
  private readonly logger: Logger;

  constructor(deps: GetCharacterSheetDeps) {
    this.characterSheetRepository = deps.characterSheetRepository;
    this.campaignRepository = deps.campaignRepository;
    this.referenceResolver = new CharacterSheetReferenceResolver({
      formationRepository: deps.formationRepository,
      peupleRepository: deps.peupleRepository,
      competenceRepository: deps.competenceRepository,
      formationCompetenceLink: deps.formationCompetenceLink,
    });
    this.sheetArmures = deps.sheetArmures;
    this.groupAccessService = deps.groupAccessService;
    this.logger = deps.logger;
  }

  public async execute(
    query: GetCharacterSheetQuery,
  ): Promise<Result<CharacterSheetDetail, AppError>> {
    const sheet = await this.characterSheetRepository.findById(query.characterSheetId);

    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    const memberAccess = await this.groupAccessService.requireMember(query.userId, sheet.groupId);
    if (memberAccess.isFailure) {
      this.logger.warn("Tentative de consultation d'une fiche par un non-membre du groupe", {
        characterSheetId: query.characterSheetId,
        userId: query.userId,
      });
      return Result.failure(memberAccess.error);
    }

    const detail = toCharacterSheetDetail(sheet);
    const campaign = await this.campaignRepository.findById(sheet.campaignId);
    const campaignName = campaign?.name.value ?? "";
    const { formation, peuple } = await this.referenceResolver.resolve(
      detail.formationId,
      detail.peupleId,
      sheet.groupId,
    );

    // Stats totales, PV et protection sont **dérivés** à la lecture (jamais stockés en dur) : on
    // écrase donc les valeurs éventuellement persistées par celles recalculées depuis les bases +
    // bonus formation/peuple + armures.
    const armures = await this.sheetArmures.findItemsBySheet(query.characterSheetId);
    const { statTotals, pointsDeVie, protection } = computeDerivedCharacterStats({
      dexterite: detail.dexterite,
      intelligence: detail.intelligence,
      perception: detail.perception,
      social: detail.social,
      vigueur: detail.vigueur,
      formation,
      peuple,
      armures: armures.map((armure) => ({ protectionPoints: armure.protectionPoints })),
    });

    return Result.success({
      ...detail,
      campaignName,
      formation,
      peuple,
      dexteriteTotale: statTotals.dexterite,
      intelligenceTotale: statTotals.intelligence,
      perceptionTotale: statTotals.perception,
      socialTotale: statTotals.social,
      vigueurTotale: statTotals.vigueur,
      pointsDeVie,
      protection,
    });
  }
}
