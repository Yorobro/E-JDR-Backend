import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { GetCharacterSheetQuery } from "@application/features/character-sheet/query/GetCharacterSheetQuery";
import { GetCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/GetCharacterSheetUseCase";
import {
  CharacterSheetDetail,
  ResolvedCompetenceView,
  ResolvedFormationView,
  ResolvedReferenceView,
} from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { toCharacterSheetDetail } from "@application/features/character-sheet/usecases/toCharacterSheetDetail";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";
import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";

/**
 * Dépendances du use case de lecture détaillée d'une fiche (regroupées dans un objet pour rester
 * sous la limite de paramètres de constructeur `ejdr/parameter-count`).
 */
export interface GetCharacterSheetDeps {
  /** Fiches de personnage (lecture). */
  readonly characterSheetRepository: CharacterSheetRepository;
  /** Catalogue des formations (résolution du nom + bonus de la formation portée par la fiche). */
  readonly formationRepository: ReferenceRepository;
  /** Catalogue des peuples (résolution du nom + bonus du peuple porté par la fiche). */
  readonly peupleRepository: ReferenceRepository;
  /** Catalogue des compétences (résolution des noms des compétences liées à la formation). */
  readonly competenceRepository: ReferenceRepository;
  /** Liaison formation ↔ compétences (ids des compétences rattachées à la formation). */
  readonly formationCompetenceLink: FormationCompetenceLinkRepository;
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
  private readonly formationRepository: ReferenceRepository;
  private readonly peupleRepository: ReferenceRepository;
  private readonly competenceRepository: ReferenceRepository;
  private readonly formationCompetenceLink: FormationCompetenceLinkRepository;
  private readonly groupAccessService: GroupAccessService;
  private readonly logger: Logger;

  constructor(deps: GetCharacterSheetDeps) {
    this.characterSheetRepository = deps.characterSheetRepository;
    this.formationRepository = deps.formationRepository;
    this.peupleRepository = deps.peupleRepository;
    this.competenceRepository = deps.competenceRepository;
    this.formationCompetenceLink = deps.formationCompetenceLink;
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
    const formation = await this.resolveFormation(detail.formationId, sheet.groupId);
    const peuple = await this.resolvePeuple(detail.peupleId, sheet.groupId);

    return Result.success({ ...detail, formation, peuple });
  }

  /**
   * Résout la formation active (nom + bonus + compétences liées), ou `null` si la fiche n'en porte
   * pas, si l'id ne correspond plus à un élément existant, ou si l'élément résolu appartient à un
   * **autre groupe** que la fiche (défense en profondeur : on ne révèle jamais un catalogue d'un
   * groupe tiers, même si la fiche porte un id étranger).
   */
  private async resolveFormation(
    formationId: string | null,
    sheetGroupId: string,
  ): Promise<ResolvedFormationView | null> {
    if (formationId === null) {
      return null;
    }
    const formation = await this.formationRepository.findById(formationId);
    if (formation === null || !formation.isInGroup(sheetGroupId)) {
      return null;
    }
    const competences = await this.resolveCompetences(formationId);
    return { ...toReferenceView(formation), competences };
  }

  /**
   * Résout le peuple actif (nom + bonus), ou `null` si la fiche n'en porte pas, si l'id ne
   * correspond plus à un élément existant, ou si l'élément résolu appartient à un **autre groupe**
   * que la fiche (défense en profondeur, voir {@link resolveFormation}).
   */
  private async resolvePeuple(
    peupleId: string | null,
    sheetGroupId: string,
  ): Promise<ResolvedReferenceView | null> {
    if (peupleId === null) {
      return null;
    }
    const peuple = await this.peupleRepository.findById(peupleId);
    return peuple === null || !peuple.isInGroup(sheetGroupId) ? null : toReferenceView(peuple);
  }

  /** Charge les compétences (id + nom) rattachées à la formation, en ignorant les ids orphelins. */
  private async resolveCompetences(formationId: string): Promise<ResolvedCompetenceView[]> {
    const competenceIds =
      await this.formationCompetenceLink.findCompetenceIdsByFormation(formationId);
    const competences: ResolvedCompetenceView[] = [];
    for (const competenceId of competenceIds) {
      const competence = await this.competenceRepository.findById(competenceId);
      if (competence !== null) {
        competences.push({ id: competence.id, name: competence.name.value });
      }
    }
    return competences;
  }
}

/** Projette un élément de référence vers sa vue résolue (id + nom + bonus de stat). */
function toReferenceView(item: ReferenceItem): ResolvedReferenceView {
  const statBonus = item.statBonus;
  return {
    id: item.id,
    name: item.name.value,
    stat: statBonus?.stat ?? null,
    bonus: statBonus?.amount ?? null,
  };
}
