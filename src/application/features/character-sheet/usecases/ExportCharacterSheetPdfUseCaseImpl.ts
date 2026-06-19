import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CharacterSheetPdfGenerator } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfGenerator";
import { ExportCharacterSheetPdfQuery } from "@application/features/character-sheet/query/ExportCharacterSheetPdfQuery";
import { ExportCharacterSheetPdfUseCase } from "@application/features/character-sheet/abstractions/usecases/ExportCharacterSheetPdfUseCase";
import { ExportedCharacterSheetPdf } from "@application/features/character-sheet/abstractions/usecases/ExportedCharacterSheetPdf";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { toCharacterSheetDetail } from "@application/features/character-sheet/usecases/toCharacterSheetDetail";
import { CharacterSheetReferenceResolver } from "@application/features/character-sheet/usecases/CharacterSheetReferenceResolver";
import { computeDerivedCharacterStats } from "@application/features/character-sheet/usecases/computeDerivedCharacterStats";
import { buildCharacterSheetPdfReferences } from "@application/features/character-sheet/usecases/buildCharacterSheetPdfReferences";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";
import { SheetReferenceLinkRepository } from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";

/**
 * Dépendances du use case d'export PDF (objet pour rester sous la limite de paramètres de
 * constructeur `ejdr/parameter-count`).
 */
export interface ExportCharacterSheetPdfDeps {
  /** Fiches de personnage (lecture + contrôle de propriété). */
  readonly characterSheetRepository: CharacterSheetRepository;
  /** Générateur PDF (port « out »). */
  readonly pdfGenerator: CharacterSheetPdfGenerator;
  /** Journalisation applicative. */
  readonly logger: Logger;
  /** Contrôle d'accès groupe (autorise aussi le MJ d'une campagne où la fiche est liée). */
  readonly groupAccessService: GroupAccessService;
  /** Catalogue des formations (résolution du nom + bonus). */
  readonly formationRepository: ReferenceRepository;
  /** Catalogue des peuples (résolution du nom + bonus). */
  readonly peupleRepository: ReferenceRepository;
  /** Catalogue des compétences (résolution des compétences liées à la formation). */
  readonly competenceRepository: ReferenceRepository;
  /** Liaison formation ↔ compétences. */
  readonly formationCompetenceLink: FormationCompetenceLinkRepository;
  /** Liaison fiche ↔ armes (noms des armes liées). */
  readonly sheetArmes: SheetReferenceLinkRepository;
  /** Liaison fiche ↔ armures (noms des armures liées). */
  readonly sheetArmures: SheetReferenceLinkRepository;
  /** Liaison fiche ↔ compétences (noms des compétences liées à la fiche). */
  readonly sheetCompetences: SheetReferenceLinkRepository;
  /** Liaison fiche ↔ équipements (noms des équipements liés). */
  readonly sheetEquipements: SheetReferenceLinkRepository;
}

/**
 * Dérive un nom de fichier sûr à partir du nom de la fiche.
 *
 * Slugifie : retire les accents (NFD), ne garde que `[a-zA-Z0-9-_ ]`, trim, remplace les
 * espaces par des tirets, passe en minuscules. Repli sur "fiche" si le slug est vide.
 *
 * @param name - Le nom de la fiche.
 * @returns Le nom de fichier `fiche-{slug}.pdf`.
 */
function toPdfFileName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `fiche-${slug.length > 0 ? slug : "fiche"}.pdf`;
}

/**
 * Use case d'export PDF d'une fiche de personnage.
 *
 * Charge la fiche, vérifie via le domaine que le demandeur en est le **propriétaire**
 * (`sheet.isOwnedBy`), projette la fiche complète, **résout** la formation/peuple et les listes
 * liées (armes/armures/compétences/équipement) en noms, puis délègue le rendu au générateur PDF.
 * Lecture pure (sans `UnitOfWork`).
 */
export class ExportCharacterSheetPdfUseCaseImpl implements ExportCharacterSheetPdfUseCase {
  private readonly characterSheetRepository: CharacterSheetRepository;
  private readonly pdfGenerator: CharacterSheetPdfGenerator;
  private readonly logger: Logger;
  private readonly groupAccessService: GroupAccessService;
  private readonly referenceResolver: CharacterSheetReferenceResolver;
  private readonly sheetArmes: SheetReferenceLinkRepository;
  private readonly sheetArmures: SheetReferenceLinkRepository;
  private readonly sheetCompetences: SheetReferenceLinkRepository;
  private readonly sheetEquipements: SheetReferenceLinkRepository;

  constructor(deps: ExportCharacterSheetPdfDeps) {
    this.characterSheetRepository = deps.characterSheetRepository;
    this.pdfGenerator = deps.pdfGenerator;
    this.logger = deps.logger;
    this.groupAccessService = deps.groupAccessService;
    this.referenceResolver = new CharacterSheetReferenceResolver({
      formationRepository: deps.formationRepository,
      peupleRepository: deps.peupleRepository,
      competenceRepository: deps.competenceRepository,
      formationCompetenceLink: deps.formationCompetenceLink,
    });
    this.sheetArmes = deps.sheetArmes;
    this.sheetArmures = deps.sheetArmures;
    this.sheetCompetences = deps.sheetCompetences;
    this.sheetEquipements = deps.sheetEquipements;
  }

  public async execute(
    query: ExportCharacterSheetPdfQuery,
  ): Promise<Result<ExportedCharacterSheetPdf, AppError>> {
    const sheet = await this.characterSheetRepository.findById(query.characterSheetId);

    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    // Exporter = propriétaire OU MJ d'une campagne où la fiche est liée (aligné sur l'édition).
    const canExport =
      sheet.isOwnedBy(query.ownerId) ||
      (await this.groupAccessService.isGameMasterOfSheetCampaign(query.ownerId, sheet.id));
    if (!canExport) {
      this.logger.warn("Tentative d'export d'une fiche sans droit (ni proprio ni MJ)", {
        characterSheetId: query.characterSheetId,
        ownerId: query.ownerId,
      });
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const detail = toCharacterSheetDetail(sheet);
    const resolved = await this.referenceResolver.resolve(
      detail.formationId,
      detail.peupleId,
      sheet.groupId,
    );
    const lists = {
      armes: await this.sheetArmes.findItemsBySheet(query.characterSheetId),
      armures: await this.sheetArmures.findItemsBySheet(query.characterSheetId),
      competences: await this.sheetCompetences.findItemsBySheet(query.characterSheetId),
      equipements: await this.sheetEquipements.findItemsBySheet(query.characterSheetId),
    };
    const references = buildCharacterSheetPdfReferences(resolved, lists);

    // Stats totales, PV et protection sont **dérivés** à la lecture (jamais stockés en dur) : le
    // détail imprimé porte les valeurs recalculées depuis les bases + bonus formation/peuple +
    // armures liées. Les caractéristiques de base (dexterite..vigueur) sont écrasées par leurs
    // **totaux** afin que le PDF affiche directement le total (base + bonus) et non la base seule.
    const { statTotals, pointsDeVie, protection } = computeDerivedCharacterStats({
      dexterite: detail.dexterite,
      intelligence: detail.intelligence,
      perception: detail.perception,
      social: detail.social,
      vigueur: detail.vigueur,
      formation: resolved.formation,
      peuple: resolved.peuple,
      armures: lists.armures.map((armure) => ({ protectionPoints: armure.protectionPoints })),
    });
    const printableDetail = {
      ...detail,
      dexterite: statTotals.dexterite,
      intelligence: statTotals.intelligence,
      perception: statTotals.perception,
      social: statTotals.social,
      vigueur: statTotals.vigueur,
      dexteriteTotale: statTotals.dexterite,
      intelligenceTotale: statTotals.intelligence,
      perceptionTotale: statTotals.perception,
      socialTotale: statTotals.social,
      vigueurTotale: statTotals.vigueur,
      pointsDeVie,
      protection,
    };

    const pdf = await this.pdfGenerator.generate(printableDetail, references);
    return Result.success({ pdf, fileName: toPdfFileName(detail.name) });
  }
}
