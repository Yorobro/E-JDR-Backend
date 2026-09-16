import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionParticipantRepository } from "@application/features/session/abstractions/repositories/SessionParticipantRepository";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { SessionLobbyView } from "@application/features/session/abstractions/usecases/CreateLobbyUseCase";
import { GetSessionLobbyUseCase } from "@application/features/session/abstractions/usecases/GetSessionLobbyUseCase";
import { GetSessionLobbyQuery } from "@application/features/session/query/GetSessionLobbyQuery";

/**
 * Use case « obtenir le lobby d'une session ».
 *
 * Charge la session, remonte à la campagne et vérifie que le demandeur est **membre** du groupe
 * (`requireMember`) — MJ comme joueur convié. Retourne la session et la liste de ses participants.
 * Lecture pure (hors `UnitOfWork`).
 */
export class GetSessionLobbyUseCaseImpl implements GetSessionLobbyUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly sessionParticipantRepository: SessionParticipantRepository,
    private readonly groupAccessService: GroupAccessService,
  ) {}

  public async execute(query: GetSessionLobbyQuery): Promise<Result<SessionLobbyView, AppError>> {
    const session = await this.sessionRepository.findById(query.sessionId);
    if (session === null) {
      return Result.failure(new SessionNotFoundError());
    }

    const campaign = await this.campaignRepository.findById(session.campaignId);
    if (campaign === null) {
      return Result.failure(new SessionNotFoundError());
    }

    const access = await this.groupAccessService.requireMember(query.actorUserId, campaign.groupId);
    if (access.isFailure) return Result.failure(access.error);

    const participants = await this.sessionParticipantRepository.findBySessionId(session.id);

    return Result.success({
      sessionId: session.id,
      campaignId: session.campaignId,
      status: session.status.value,
      participants: participants.map((participant) => ({
        userId: participant.userId,
        status: participant.status.value,
      })),
    });
  }
}
