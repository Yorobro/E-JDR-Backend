import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
import { CharacterSheetPdfGenerator } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfGenerator";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { CreateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/CreateCharacterSheetUseCaseImpl";
import { ListMyCharacterSheetsUseCaseImpl } from "@application/features/character-sheet/usecases/ListMyCharacterSheetsUseCaseImpl";
import { DeleteCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/DeleteCharacterSheetUseCaseImpl";
import { GetCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/GetCharacterSheetUseCaseImpl";
import { UpdateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/UpdateCharacterSheetUseCaseImpl";
import { GetSheetCampaignsUseCaseImpl } from "@application/features/character-sheet/usecases/GetSheetCampaignsUseCaseImpl";
import { ExportCharacterSheetPdfUseCaseImpl } from "@application/features/character-sheet/usecases/ExportCharacterSheetPdfUseCaseImpl";
import { CharacterSheetController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetController";
import { CharacterSheetExportController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetExportController";

/** Services partagés requis pour assembler les controllers de fiches. */
export interface CharacterSheetControllerDeps {
  readonly characterSheetRepository: CharacterSheetRepository;
  readonly campaignCharacterRepository: CampaignCharacterRepository;
  readonly formationRepository: ReferenceRepository;
  readonly peupleRepository: ReferenceRepository;
  readonly groupAccessService: GroupAccessService;
  readonly pdfGenerator: CharacterSheetPdfGenerator;
  readonly idGenerator: IdGeneratorService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
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
  return new CharacterSheetController(
    new CreateCharacterSheetUseCaseImpl(
      deps.idGenerator,
      deps.groupAccessService,
      deps.unitOfWork,
      deps.logger,
    ),
    new ListMyCharacterSheetsUseCaseImpl(deps.characterSheetRepository, deps.groupAccessService),
    new DeleteCharacterSheetUseCaseImpl(
      deps.characterSheetRepository,
      deps.unitOfWork,
      deps.logger,
    ),
    new GetCharacterSheetUseCaseImpl(
      deps.characterSheetRepository,
      deps.groupAccessService,
      deps.logger,
    ),
    new UpdateCharacterSheetUseCaseImpl(
      deps.characterSheetRepository,
      deps.formationRepository,
      deps.peupleRepository,
      deps.groupAccessService,
      deps.unitOfWork,
      deps.logger,
    ),
    new GetSheetCampaignsUseCaseImpl(
      deps.characterSheetRepository,
      deps.campaignCharacterRepository,
      deps.logger,
    ),
  );
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
    new ExportCharacterSheetPdfUseCaseImpl(
      deps.characterSheetRepository,
      deps.pdfGenerator,
      deps.logger,
    ),
  );
}
