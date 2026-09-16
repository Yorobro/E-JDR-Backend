import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionParticipantRepository } from "@application/features/session/abstractions/repositories/SessionParticipantRepository";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { ParticipantNotFoundError } from "@application/features/session/errors/ParticipantNotFoundError";
import { SessionNotJoinableError } from "@application/features/session/errors/SessionNotJoinableError";
import { RespondToInvitationCommand } from "@application/features/session/commands/RespondToInvitationCommand";
import { RespondToInvitationUseCase } from "@application/features/session/abstractions/usecases/RespondToInvitationUseCase";

/**
 * Use case « un joueur convié répond à son invitation de session ».
 *
 * Orchestration pure :
 * 1. la session doit exister et sa campagne aussi ;
 * 2. la session doit être en salon d'attente (`LOBBY`) — on ne répond qu'à un lobby ouvert ;
 * 3. le demandeur doit avoir une participation sur cette session (il a bien été convié) ;
 * 4. la transition (`accept`/`refuse`) et l'invariant « on ne répond qu'une fois » sont portés
 *    par l'entité {@link SessionParticipant} ; l'écriture passe par le `UnitOfWork`.
 *
 * Notifie ensuite le groupe (best-effort) pour rafraîchir le lobby du MJ en temps réel.
 */
export class RespondToInvitationUseCaseImpl implements RespondToInvitationUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly sessionParticipantRepository: SessionParticipantRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
    private readonly realtimeNotifier: RealtimeNotifier,
  ) {}

  public async execute(command: RespondToInvitationCommand): Promise<Result<void, AppError>> {
    const session = await this.sessionRepository.findById(command.sessionId);
    if (session === null) {
      return Result.failure(new SessionNotFoundError());
    }

    const campaign = await this.campaignRepository.findById(session.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    // On ne répond qu'à un salon d'attente ouvert (ni PLANNED, ni ACTIVE/ENDED).
    if (!session.status.isLobby()) {
      return Result.failure(new SessionNotJoinableError(session.status.value));
    }

    const participant = await this.sessionParticipantRepository.findBySessionIdAndUserId(
      command.sessionId,
      command.actorUserId,
    );
    if (participant === null) {
      return Result.failure(new ParticipantNotFoundError());
    }

    // Transition portée par l'entité : échoue si le joueur a déjà répondu.
    const respondedAt = new Date();
    let updated;
    try {
      updated = command.accept
        ? participant.accept({ respondedAt })
        : participant.refuse({ respondedAt });
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.sessionParticipants.update(updated);
    });

    this.logger.info("Réponse à une invitation de session", {
      sessionId: session.id,
      userId: command.actorUserId,
      status: updated.status.value,
    });

    // Rafraîchit le lobby du MJ (via le canal du groupe de la campagne) — best-effort.
    this.realtimeNotifier.notifyGroupChanged(campaign.groupId, "session-participants");

    return Result.success(undefined);
  }
}
