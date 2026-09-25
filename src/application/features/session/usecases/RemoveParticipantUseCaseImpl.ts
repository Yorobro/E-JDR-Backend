import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionParticipantRepository } from "@application/features/session/abstractions/repositories/SessionParticipantRepository";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { LobbyNotOpenError } from "@application/features/session/errors/LobbyNotOpenError";
import { ParticipantNotFoundError } from "@application/features/session/errors/ParticipantNotFoundError";
import { SessionLobbyView } from "@application/features/session/abstractions/usecases/CreateLobbyUseCase";
import { RemoveParticipantCommand } from "@application/features/session/commands/RemoveParticipantCommand";
import { RemoveParticipantUseCase } from "@application/features/session/abstractions/usecases/RemoveParticipantUseCase";

/**
 * Dépendances du use case de retrait d'un joueur du lobby, passées en un seul objet pour rester
 * sous la limite de paramètres (même pattern que `InviteToLobbyDeps`).
 */
export interface RemoveParticipantDeps {
  readonly sessionRepository: SessionRepository;
  readonly campaignRepository: CampaignRepository;
  readonly sessionParticipantRepository: SessionParticipantRepository;
  readonly groupAccessService: GroupAccessService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
  readonly realtimeNotifier: RealtimeNotifier;
}

/**
 * Use case « retirer un joueur d'un salon d'attente ouvert ».
 *
 * Orchestration pure : vérifie que la session et sa campagne existent, que le demandeur est
 * **éditeur** du groupe (`requireEditor`), que le salon est bien ouvert (`LOBBY`) et que le
 * joueur visé est bien convié. Puis supprime l'association — aucun changement d'état d'entité,
 * donc **rien à demander au domaine** (à la différence de la réinvitation).
 *
 * Écriture dans une transaction, puis notification temps réel : l'invitation en attente
 * disparaît de l'écran du joueur retiré et le lobby se rafraîchit pour tout le groupe.
 */
export class RemoveParticipantUseCaseImpl implements RemoveParticipantUseCase {
  private readonly sessionRepository: SessionRepository;
  private readonly campaignRepository: CampaignRepository;
  private readonly sessionParticipantRepository: SessionParticipantRepository;
  private readonly groupAccessService: GroupAccessService;
  private readonly unitOfWork: UnitOfWork;
  private readonly logger: Logger;
  private readonly realtimeNotifier: RealtimeNotifier;

  constructor(deps: RemoveParticipantDeps) {
    this.sessionRepository = deps.sessionRepository;
    this.campaignRepository = deps.campaignRepository;
    this.sessionParticipantRepository = deps.sessionParticipantRepository;
    this.groupAccessService = deps.groupAccessService;
    this.unitOfWork = deps.unitOfWork;
    this.logger = deps.logger;
    this.realtimeNotifier = deps.realtimeNotifier;
  }

  public async execute(
    command: RemoveParticipantCommand,
  ): Promise<Result<SessionLobbyView, AppError>> {
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

    // On ne retire que depuis un salon d'attente ouvert : écarter un joueur d'une partie déjà
    // lancée (ACTIVE) est une autre opération, avec d'autres conséquences.
    if (!session.status.isLobby()) {
      return Result.failure(new LobbyNotOpenError(session.status.value));
    }

    // Existence = règle métier, tranchée ici. Le repository, lui, exécute sans juger : une
    // suppression d'une ligne absente réussirait silencieusement.
    const participant = await this.sessionParticipantRepository.findBySessionIdAndUserId(
      session.id,
      command.participantUserId,
    );
    if (participant === null) {
      return Result.failure(new ParticipantNotFoundError());
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.sessionParticipants.deleteBySessionIdAndUserId(
        session.id,
        command.participantUserId,
      );
    });

    this.logger.info("Joueur retiré d'un lobby ouvert", {
      sessionId: session.id,
      campaignId: campaign.id,
      participantUserId: command.participantUserId,
    });
    this.notify(campaign.groupId, command.participantUserId);

    // Vue complète du lobby, relue après coup : l'appelant remplace son état d'un bloc plutôt
    // que de retirer la ligne localement.
    const participants = await this.sessionParticipantRepository.findBySessionId(session.id);

    return Result.success({
      sessionId: session.id,
      campaignId: session.campaignId,
      status: session.status.value,
      participants: participants.map((remaining) => ({
        userId: remaining.userId,
        status: remaining.status.value,
      })),
    });
  }

  /**
   * Fait disparaître l'invitation en attente chez le joueur retiré et rafraîchit le lobby de
   * tout le groupe (sa ligne s'efface chez le MJ comme chez les autres). Best-effort.
   *
   * @param groupId - Groupe de la campagne parente.
   * @param participantUserId - Joueur qui vient d'être retiré.
   */
  private notify(groupId: string, participantUserId: string): void {
    this.realtimeNotifier.notifyUserChanged(participantUserId, "session-invitations");
    this.realtimeNotifier.notifyGroupChanged(groupId, "session-participants");
  }
}
