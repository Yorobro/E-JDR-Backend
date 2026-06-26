import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { CreateCampaignUseCaseImpl } from "@application/features/campaign/usecases/CreateCampaignUseCaseImpl";
import { ListMyCampaignsUseCaseImpl } from "@application/features/campaign/usecases/ListMyCampaignsUseCaseImpl";
import { DeleteCampaignUseCaseImpl } from "@application/features/campaign/usecases/DeleteCampaignUseCaseImpl";
import { ListCampaignCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListCampaignCharactersUseCaseImpl";
import { ListPendingCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListPendingCharactersUseCaseImpl";
import { RespondToCampaignLinkRequestUseCaseImpl } from "@application/features/character-sheet/usecases/RespondToCampaignLinkRequestUseCaseImpl";
import { CampaignController } from "@presentation/http/features/campaign/controllers/CampaignController";
import { CampaignCharacterController } from "@presentation/http/features/campaign/controllers/CampaignCharacterController";

/**
 * Dépendances nécessaires à l'assemblage des controllers campagne.
 *
 * Extraites du composition root (`main.ts`) pour garder ce dernier sous la limite de taille.
 * Le `groupAccessService` permet de scoper les campagnes par groupe (création/listing/suppression
 * réservés aux membres du groupe).
 */
export interface CampaignControllerDeps {
  readonly campaignRepository: CampaignRepository;
  readonly characterSheetRepository: CharacterSheetRepository;
  readonly groupAccessService: GroupAccessService;
  readonly idGenerator: IdGeneratorService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
  readonly realtimeNotifier: RealtimeNotifier;
}

/**
 * Assemble le controller campaign (créer / lister / supprimer une campagne).
 *
 * Toutes les opérations sont scopées par groupe via le `groupAccessService` : seul un membre du
 * groupe peut créer ou lister ses campagnes, et seul le MJ encore membre peut supprimer.
 *
 * @param deps - Les services partagés requis par les use cases campaign.
 * @returns Le controller campaign câblé.
 */
export function buildCampaignController(deps: CampaignControllerDeps): CampaignController {
  const createCampaign = new CreateCampaignUseCaseImpl(
    deps.idGenerator,
    deps.groupAccessService,
    deps.unitOfWork,
    deps.logger,
  );
  const listMyCampaigns = new ListMyCampaignsUseCaseImpl(
    deps.campaignRepository,
    deps.groupAccessService,
  );
  const deleteCampaign = new DeleteCampaignUseCaseImpl(
    deps.campaignRepository,
    deps.groupAccessService,
    deps.unitOfWork,
    deps.logger,
  );

  return new CampaignController(createCampaign, listMyCampaigns, deleteCampaign);
}

/**
 * Assemble le controller des personnages d'une campagne (lister validées / en attente, valider ou
 * refuser une demande de rattachement).
 *
 * @param deps - Les services partagés requis par les use cases.
 * @returns Le controller câblé.
 */
export function buildCampaignCharacterController(
  deps: CampaignControllerDeps,
): CampaignCharacterController {
  const listCampaignCharacters = new ListCampaignCharactersUseCaseImpl(
    deps.campaignRepository,
    deps.characterSheetRepository,
  );
  const listPendingCharacters = new ListPendingCharactersUseCaseImpl(
    deps.campaignRepository,
    deps.characterSheetRepository,
  );
  const respondToLinkRequest = new RespondToCampaignLinkRequestUseCaseImpl(
    deps.campaignRepository,
    deps.characterSheetRepository,
    deps.unitOfWork,
    deps.logger,
    deps.realtimeNotifier,
  );

  return new CampaignCharacterController(
    listCampaignCharacters,
    listPendingCharacters,
    respondToLinkRequest,
  );
}
