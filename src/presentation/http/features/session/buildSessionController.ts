import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { CreateSessionUseCaseImpl } from "@application/features/session/usecases/CreateSessionUseCaseImpl";
import { ListCampaignSessionsUseCaseImpl } from "@application/features/session/usecases/ListCampaignSessionsUseCaseImpl";
import { GetSessionUseCaseImpl } from "@application/features/session/usecases/GetSessionUseCaseImpl";
import { UpdateSessionUseCaseImpl } from "@application/features/session/usecases/UpdateSessionUseCaseImpl";
import { DeleteSessionUseCaseImpl } from "@application/features/session/usecases/DeleteSessionUseCaseImpl";
import { SessionController } from "@presentation/http/features/session/controllers/SessionController";

/**
 * Dépendances nécessaires à l'assemblage du controller session.
 *
 * Les use cases gèrent l'autorisation en remontant à la campagne parente (`isGameMaster`),
 * d'où la présence du `campaignRepository` à côté du `sessionRepository`.
 */
export interface SessionControllerDeps {
  readonly campaignRepository: CampaignRepository;
  readonly sessionRepository: SessionRepository;
  readonly idGenerator: IdGeneratorService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
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
  );
  const listCampaignSessions = new ListCampaignSessionsUseCaseImpl(
    deps.campaignRepository,
    deps.sessionRepository,
  );
  const getSession = new GetSessionUseCaseImpl(deps.sessionRepository, deps.campaignRepository);
  const updateSession = new UpdateSessionUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.unitOfWork,
    deps.logger,
  );
  const deleteSession = new DeleteSessionUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.unitOfWork,
    deps.logger,
  );

  return new SessionController(
    createSession,
    listCampaignSessions,
    getSession,
    updateSession,
    deleteSession,
  );
}
