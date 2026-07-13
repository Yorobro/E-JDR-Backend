import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CharacterSheetPdfGenerator } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfGenerator";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";
import { SheetReferenceLinkRepository } from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { CreateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/CreateCharacterSheetUseCaseImpl";
import { ListMyCharacterSheetsUseCaseImpl } from "@application/features/character-sheet/usecases/ListMyCharacterSheetsUseCaseImpl";
import { DeleteCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/DeleteCharacterSheetUseCaseImpl";
import { GetCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/GetCharacterSheetUseCaseImpl";
import { UpdateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/UpdateCharacterSheetUseCaseImpl";
import { GetSheetCampaignsUseCaseImpl } from "@application/features/character-sheet/usecases/GetSheetCampaignsUseCaseImpl";
import { CopyCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/CopyCharacterSheetUseCaseImpl";
import { ExportCharacterSheetPdfUseCaseImpl } from "@application/features/character-sheet/usecases/ExportCharacterSheetPdfUseCaseImpl";
import { CharacterSheetController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetController";
import { CharacterSheetExportController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetExportController";

/** Services partagés requis pour assembler les controllers de fiches. */
export interface CharacterSheetControllerDeps {
  readonly characterSheetRepository: CharacterSheetRepository;
  readonly campaignRepository: CampaignRepository;
  readonly formationRepository: ReferenceRepository;
  readonly peupleRepository: ReferenceRepository;
  readonly competenceRepository: ReferenceRepository;
  readonly formationCompetenceLinkRepository: FormationCompetenceLinkRepository;
  /** Liaisons fiche ↔ éléments (noms des armes/armures/compétences/équipements/sorts/miracles liés, pour le PDF). */
  readonly sheetArmesRepository: SheetReferenceLinkRepository;
  readonly sheetArmuresRepository: SheetReferenceLinkRepository;
  readonly sheetCompetencesRepository: SheetReferenceLinkRepository;
  readonly sheetEquipementsRepository: SheetReferenceLinkRepository;
  readonly sheetSortsRepository: SheetReferenceLinkRepository;
  readonly sheetMiraclesRepository: SheetReferenceLinkRepository;
  readonly groupAccessService: GroupAccessService;
  readonly pdfGenerator: CharacterSheetPdfGenerator;
  readonly idGenerator: IdGeneratorService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
  /** Notifier temps réel : rafraîchit « Mes fiches » sur les autres appareils du propriétaire. */
  readonly realtimeNotifier: RealtimeNotifier;
}

/**
 * Assemble le controller CRUD des fiches de personnage. Extrait du composition root pour garder
 * `main.ts` sous la limite de taille (`ejdr/file-size`).
 *
 * @param deps - Les services partagés produits par le composition root.
 * @returns Le controller fiches câblé.
 */
export function buildCharacterSheetController(
  deps: CharacterSheetControllerDeps,
): CharacterSheetController {
  return new CharacterSheetController({
    createCharacterSheet: new CreateCharacterSheetUseCaseImpl(
      deps.idGenerator,
      deps.campaignRepository,
      deps.groupAccessService,
      deps.unitOfWork,
      deps.logger,
      deps.realtimeNotifier,
    ),
    listMyCharacterSheets: new ListMyCharacterSheetsUseCaseImpl(
      deps.characterSheetRepository,
      deps.campaignRepository,
      deps.groupAccessService,
    ),
    deleteCharacterSheet: new DeleteCharacterSheetUseCaseImpl(
      deps.characterSheetRepository,
      deps.unitOfWork,
      deps.logger,
      deps.groupAccessService,
      deps.realtimeNotifier,
    ),
    getCharacterSheet: new GetCharacterSheetUseCaseImpl({
      characterSheetRepository: deps.characterSheetRepository,
      campaignRepository: deps.campaignRepository,
      formationRepository: deps.formationRepository,
      peupleRepository: deps.peupleRepository,
      competenceRepository: deps.competenceRepository,
      formationCompetenceLink: deps.formationCompetenceLinkRepository,
      sheetArmures: deps.sheetArmuresRepository,
      groupAccessService: deps.groupAccessService,
      logger: deps.logger,
    }),
    updateCharacterSheet: new UpdateCharacterSheetUseCaseImpl({
      characterSheetRepository: deps.characterSheetRepository,
      formationRepository: deps.formationRepository,
      peupleRepository: deps.peupleRepository,
      groupAccessService: deps.groupAccessService,
      unitOfWork: deps.unitOfWork,
      logger: deps.logger,
      realtimeNotifier: deps.realtimeNotifier,
    }),
    getSheetCampaigns: new GetSheetCampaignsUseCaseImpl(deps.characterSheetRepository, deps.logger),
    copyCharacterSheet: new CopyCharacterSheetUseCaseImpl({
      idGenerator: deps.idGenerator,
      campaignRepository: deps.campaignRepository,
      characterSheetRepository: deps.characterSheetRepository,
      sourceLinks: {
        armes: deps.sheetArmesRepository,
        armures: deps.sheetArmuresRepository,
        competences: deps.sheetCompetencesRepository,
        equipements: deps.sheetEquipementsRepository,
        sorts: deps.sheetSortsRepository,
        miracles: deps.sheetMiraclesRepository,
      },
      unitOfWork: deps.unitOfWork,
      logger: deps.logger,
      realtimeNotifier: deps.realtimeNotifier,
    }),
  });
}

/**
 * Assemble le controller d'export PDF (distinct du CRUD, déjà au plafond de dépendances).
 *
 * @param deps - Les services partagés produits par le composition root.
 * @returns Le controller d'export PDF câblé.
 */
export function buildCharacterSheetExportController(
  deps: CharacterSheetControllerDeps,
): CharacterSheetExportController {
  return new CharacterSheetExportController(
    new ExportCharacterSheetPdfUseCaseImpl({
      characterSheetRepository: deps.characterSheetRepository,
      pdfGenerator: deps.pdfGenerator,
      logger: deps.logger,
      groupAccessService: deps.groupAccessService,
      formationRepository: deps.formationRepository,
      peupleRepository: deps.peupleRepository,
      competenceRepository: deps.competenceRepository,
      formationCompetenceLink: deps.formationCompetenceLinkRepository,
      sheetArmes: deps.sheetArmesRepository,
      sheetArmures: deps.sheetArmuresRepository,
      // Pas de `sheetCompetences` : les compétences du PDF sont dérivées de la formation.
      sheetEquipements: deps.sheetEquipementsRepository,
      sheetSorts: deps.sheetSortsRepository,
      sheetMiracles: deps.sheetMiraclesRepository,
    }),
  );
}
