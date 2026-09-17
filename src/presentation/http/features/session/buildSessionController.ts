import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionParticipantRepository } from "@application/features/session/abstractions/repositories/SessionParticipantRepository";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { CreateSessionUseCaseImpl } from "@application/features/session/usecases/CreateSessionUseCaseImpl";
import { CreateLobbyUseCaseImpl } from "@application/features/session/usecases/CreateLobbyUseCaseImpl";
import { InviteToLobbyUseCaseImpl } from "@application/features/session/usecases/InviteToLobbyUseCaseImpl";
import { ListCampaignSessionsUseCaseImpl } from "@application/features/session/usecases/ListCampaignSessionsUseCaseImpl";
import { GetSessionUseCaseImpl } from "@application/features/session/usecases/GetSessionUseCaseImpl";
import { UpdateSessionUseCaseImpl } from "@application/features/session/usecases/UpdateSessionUseCaseImpl";
import { DeleteSessionUseCaseImpl } from "@application/features/session/usecases/DeleteSessionUseCaseImpl";
import { RespondToInvitationUseCaseImpl } from "@application/features/session/usecases/RespondToInvitationUseCaseImpl";
import { StartSessionUseCaseImpl } from "@application/features/session/usecases/StartSessionUseCaseImpl";
import { ListMySessionInvitationsUseCaseImpl } from "@application/features/session/usecases/ListMySessionInvitationsUseCaseImpl";
import { GetSessionLobbyUseCaseImpl } from "@application/features/session/usecases/GetSessionLobbyUseCaseImpl";
import { SessionController } from "@presentation/http/features/session/controllers/SessionController";

/**
 * Dépendances nécessaires à l'assemblage du controller session.
 *
 * Les lectures (get/list sessions) autorisent tout **membre** du groupe via le `groupAccessService` ;
 * les écritures (create/update/delete) sont réservées au **MJ de la campagne** (`campaign.isGameMaster`),
 * d'où la présence du `campaignRepository` à côté du `sessionRepository`.
 */
export interface SessionControllerDeps {
  readonly campaignRepository: CampaignRepository;
  readonly sessionRepository: SessionRepository;
  readonly sessionParticipantRepository: SessionParticipantRepository;
  readonly groupMemberRepository: GroupMemberRepository;
  readonly idGenerator: IdGeneratorService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
  readonly groupAccessService: GroupAccessService;
  readonly realtimeNotifier: RealtimeNotifier;
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
    deps.realtimeNotifier,
  );
  const createLobby = new CreateLobbyUseCaseImpl({
    sessionRepository: deps.sessionRepository,
    campaignRepository: deps.campaignRepository,
    groupMemberRepository: deps.groupMemberRepository,
    groupAccessService: deps.groupAccessService,
    unitOfWork: deps.unitOfWork,
    logger: deps.logger,
    realtimeNotifier: deps.realtimeNotifier,
  });
  const inviteToLobby = new InviteToLobbyUseCaseImpl({
    sessionRepository: deps.sessionRepository,
    campaignRepository: deps.campaignRepository,
    sessionParticipantRepository: deps.sessionParticipantRepository,
    groupMemberRepository: deps.groupMemberRepository,
    groupAccessService: deps.groupAccessService,
    unitOfWork: deps.unitOfWork,
    logger: deps.logger,
    realtimeNotifier: deps.realtimeNotifier,
  });
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
    deps.realtimeNotifier,
  );
  const deleteSession = new DeleteSessionUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.unitOfWork,
    deps.logger,
    deps.realtimeNotifier,
  );
  const respondToInvitation = new RespondToInvitationUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.sessionParticipantRepository,
    deps.unitOfWork,
    deps.logger,
    deps.realtimeNotifier,
  );
  const startSession = new StartSessionUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.groupAccessService,
    deps.unitOfWork,
    deps.logger,
    deps.realtimeNotifier,
  );
  const listMyInvitations = new ListMySessionInvitationsUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.sessionParticipantRepository,
  );
  const getSessionLobby = new GetSessionLobbyUseCaseImpl(
    deps.sessionRepository,
    deps.campaignRepository,
    deps.sessionParticipantRepository,
    deps.groupAccessService,
  );

  return new SessionController({
    createSession,
    createLobby,
    inviteToLobby,
    listCampaignSessions,
    getSession,
    updateSession,
    deleteSession,
    respondToInvitation,
    startSession,
    listMyInvitations,
    getSessionLobby,
  });
}
