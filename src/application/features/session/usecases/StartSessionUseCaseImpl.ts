import { DomainError } from "@domain/shared/errors/DomainError";
import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionParticipantRepository } from "@application/features/session/abstractions/repositories/SessionParticipantRepository";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { StartSessionCommand } from "@application/features/session/commands/StartSessionCommand";
import { StartSessionUseCase } from "@application/features/session/abstractions/usecases/StartSessionUseCase";

/**
 * Dépendances du use case de démarrage de session, passées en un seul objet pour rester sous la
 * limite de paramètres (même pattern que `RemoveParticipantDeps`).
 */
export interface StartSessionDeps {
  readonly sessionRepository: SessionRepository;
  readonly campaignRepository: CampaignRepository;
  readonly sessionParticipantRepository: SessionParticipantRepository;
  readonly groupAccessService: GroupAccessService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
  readonly realtimeNotifier: RealtimeNotifier;
}

/**
 * Use case « le MJ démarre réellement la session ».
 *
 * Orchestration pure :
 * 1. la session doit exister et sa campagne aussi ;
 * 2. le demandeur doit être **éditeur** du groupe (`requireEditor`) — c'est le MJ ;
 * 3. la transition `LOBBY → ACTIVE` (et l'invariant « on ne démarre que depuis LOBBY ») est
 *    portée par l'entité {@link Session.start} ; l'écriture passe par le `UnitOfWork`.
 *
 * Notifie ensuite (best-effort, resource `session-status`) le groupe **et** chaque occupant du
 * salon sur son canal personnel — voir {@link StartSessionUseCaseImpl.notify}.
 */
export class StartSessionUseCaseImpl implements StartSessionUseCase {
  private readonly sessionRepository: SessionRepository;
  private readonly campaignRepository: CampaignRepository;
  private readonly sessionParticipantRepository: SessionParticipantRepository;
  private readonly groupAccessService: GroupAccessService;
  private readonly unitOfWork: UnitOfWork;
  private readonly logger: Logger;
  private readonly realtimeNotifier: RealtimeNotifier;

  constructor(deps: StartSessionDeps) {
    this.sessionRepository = deps.sessionRepository;
    this.campaignRepository = deps.campaignRepository;
    this.sessionParticipantRepository = deps.sessionParticipantRepository;
    this.groupAccessService = deps.groupAccessService;
    this.unitOfWork = deps.unitOfWork;
    this.logger = deps.logger;
    this.realtimeNotifier = deps.realtimeNotifier;
  }

  public async execute(command: StartSessionCommand): Promise<Result<void, AppError>> {
    const session = await this.sessionRepository.findById(command.sessionId);
    if (session === null) {
      return Result.failure(new SessionNotFoundError());
    }

    const campaign = await this.campaignRepository.findById(session.campaignId);
    if (campaign === null) {
      return Result.failure(new CampaignNotFoundError());
    }

    const access = await this.groupAccessService.requireEditor(
      command.actorUserId,
      campaign.groupId,
    );
    if (access.isFailure) return Result.failure(access.error);

    // Transition métier portée par l'entité : échoue si la session n'est pas au statut LOBBY.
    let started;
    try {
      started = session.start({ startedAt: new Date() });
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.sessions.update(started);
    });

    this.logger.info("Session démarrée", {
      sessionId: session.id,
      campaignId: campaign.id,
    });

    const participants = await this.sessionParticipantRepository.findBySessionId(session.id);
    this.notify(campaign.groupId, command.actorUserId, participants);

    return Result.success(undefined);
  }

  /**
   * Annonce le démarrage — best-effort, sur **deux portées complémentaires**.
   *
   * `notifyGroupChanged` fait basculer vers l'écran de jeu ceux qui regardent le salon : le canal
   * `group:{id}` n'est abonné que par les écrans qui le demandent explicitement, donc il ne porte
   * que jusqu'aux clients restés sur une page du groupe.
   *
   * D'où le second envoi, sur le canal personnel de chaque occupant du salon. Le serveur abonne
   * chaque socket à `user:{id}` dès le handshake WebSocket : cet envoi-là atteint le joueur **où
   * qu'il soit** dans l'application, exactement comme `session-removed`. C'est ce qui permet au
   * client de transformer le raccourci « retour au salon » en « rejoindre la partie » même chez un
   * joueur parti voir sa fiche de personnage.
   *
   * Seuls les participants `ACCEPTED` sont concernés : un joueur qui n'a pas répondu ou qui a
   * refusé n'a pas de salon à quitter, donc rien à rediriger. Le MJ, lui, est destinataire sans
   * être participant — il peut lui aussi avoir quitté la page du salon.
   *
   * @param groupId - Groupe de la campagne parente.
   * @param actorUserId - Le MJ qui vient de démarrer.
   * @param participants - Toutes les participations de la session.
   */
  private notify(
    groupId: string,
    actorUserId: string,
    participants: readonly SessionParticipant[],
  ): void {
    this.realtimeNotifier.notifyGroupChanged(groupId, "session-status");

    const recipients = new Set<string>([actorUserId]);
    for (const participant of participants) {
      if (participant.status.isAccepted()) recipients.add(participant.userId);
    }
    for (const userId of recipients) {
      this.realtimeNotifier.notifyUserChanged(userId, "session-status");
    }
  }
}
