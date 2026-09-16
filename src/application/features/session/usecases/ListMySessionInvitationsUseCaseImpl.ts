import { SessionDate } from "@domain/features/session/value-objects/SessionDate";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionParticipantRepository } from "@application/features/session/abstractions/repositories/SessionParticipantRepository";
import { ListMySessionInvitationsQuery } from "@application/features/session/query/ListMySessionInvitationsQuery";
import {
  ListMySessionInvitationsUseCase,
  SessionInvitationView,
} from "@application/features/session/abstractions/usecases/ListMySessionInvitationsUseCase";

/**
 * Use case « lister mes invitations de session en attente ».
 *
 * Lecture pure (hors `UnitOfWork`) : récupère les participations `INVITED` du demandeur, puis
 * remonte à chaque session et à sa campagne pour composer une vue affichable. Seules les
 * sessions encore en **salon d'attente** (`LOBBY`) sont conservées : une invitation à une session
 * démarrée ou terminée n'a plus de sens. Les participations orphelines (session/campagne
 * disparue) sont ignorées silencieusement.
 */
export class ListMySessionInvitationsUseCaseImpl implements ListMySessionInvitationsUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly sessionParticipantRepository: SessionParticipantRepository,
  ) {}

  public async execute(
    query: ListMySessionInvitationsQuery,
  ): Promise<Result<SessionInvitationView[], AppError>> {
    const participations = await this.sessionParticipantRepository.findInvitedByUserId(
      query.actorUserId,
    );

    const invitations: SessionInvitationView[] = [];
    for (const participation of participations) {
      const session = await this.sessionRepository.findById(participation.sessionId);
      if (session === null || !session.status.isLobby()) continue;

      const campaign = await this.campaignRepository.findById(session.campaignId);
      if (campaign === null) continue;

      invitations.push({
        sessionId: session.id,
        title: session.title.value,
        date: SessionDate.fromDate(session.date).toIsoDate(),
        campaignId: campaign.id,
        campaignName: campaign.name.value,
        groupId: campaign.groupId,
      });
    }

    return Result.success(invitations);
  }
}
