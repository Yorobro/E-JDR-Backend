import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { CreateSessionUseCaseImpl } from "@application/features/session/usecases/CreateSessionUseCaseImpl";
import { CreateLobbyUseCaseImpl } from "@application/features/session/usecases/CreateLobbyUseCaseImpl";
import { ListCampaignSessionsUseCaseImpl } from "@application/features/session/usecases/ListCampaignSessionsUseCaseImpl";
import { GetSessionUseCaseImpl } from "@application/features/session/usecases/GetSessionUseCaseImpl";
import { UpdateSessionUseCaseImpl } from "@application/features/session/usecases/UpdateSessionUseCaseImpl";
import { DeleteSessionUseCaseImpl } from "@application/features/session/usecases/DeleteSessionUseCaseImpl";
import { SessionController } from "@presentation/http/features/session/controllers/SessionController";

/**
 * Dépendances nécessaires à l'assemblage du controller session.
 *
 * Les use cases gèrent l'autorisation via le `groupAccessService` (rôle dans le groupe
 * de la campagne parente), d'où la présence du `campaignRepository` à côté du `sessionRepository`.
 */
export interface SessionControllerDeps {
  readonly campaignRepository: CampaignRepository;
  readonly sessionRepository: SessionRepository;
  readonly groupMemberRepository: GroupMemberRepository;
  readonly idGenerator: IdGeneratorService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
  readonly groupAccessService: GroupAccessService;
}

/**
 * Assemble le controller session (CRUD des sessions d'une campagne).
 *
 * Extrait du composition root (`main.ts`) pour garder ce dernier sous la limite de taille :
 * câble les cinq use cases sur leurs dépendances et les passe au controller.
 *
 * @param deps - Les services partagés requis par les use cases session.
 * @returns Le controller session câblé.
 */
export function buildSessionController(deps: SessionControllerDeps): SessionController {
  const createSession = new CreateSessionUseCaseImpl(
    deps.campaignRepository,
    deps.idGenerator,
    deps.unitOfWork,
    deps.logger,
    deps.groupAccessService,
  );
  const createLobby = new CreateLobbyUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.groupMemberRepository,
    deps.groupAccessService,
    deps.unitOfWork,
    deps.logger,
  );
  const listCampaignSessions = new ListCampaignSessionsUseCaseImpl(
    deps.campaignRepository,
    deps.sessionRepository,
    deps.groupAccessService,
  );
  const getSession = new GetSessionUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.groupAccessService,
  );
  const updateSession = new UpdateSessionUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.unitOfWork,
    deps.logger,
    deps.groupAccessService,
  );
  const deleteSession = new DeleteSessionUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.unitOfWork,
    deps.logger,
    deps.groupAccessService,
  );

  return new SessionController(
    createSession,
    createLobby,
    listCampaignSessions,
    getSession,
    updateSession,
    deleteSession,
  );
}
