import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionParticipantRepository } from "@application/features/session/abstractions/repositories/SessionParticipantRepository";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { EmptyParticipantSelectionError } from "@application/features/session/errors/EmptyParticipantSelectionError";
import { ParticipantNotInGroupError } from "@application/features/session/errors/ParticipantNotInGroupError";
import { LobbyNotOpenError } from "@application/features/session/errors/LobbyNotOpenError";
import { SessionLobbyView } from "@application/features/session/abstractions/usecases/CreateLobbyUseCase";
import { InviteToLobbyCommand } from "@application/features/session/commands/InviteToLobbyCommand";
import { InviteToLobbyUseCase } from "@application/features/session/abstractions/usecases/InviteToLobbyUseCase";

/**
 * Dépendances du use case d'invitation dans un lobby ouvert, passées en un seul objet pour
 * rester sous la limite de paramètres (même pattern que `CreateLobbyDeps`).
 */
export interface InviteToLobbyDeps {
  readonly sessionRepository: SessionRepository;
  readonly campaignRepository: CampaignRepository;
  readonly sessionParticipantRepository: SessionParticipantRepository;
  readonly groupMemberRepository: GroupMemberRepository;
  readonly groupAccessService: GroupAccessService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
  readonly realtimeNotifier: RealtimeNotifier;
}

/**
 * Use case « convier un joueur à un salon d'attente déjà ouvert » (oubli ou refus accidentel).
 *
 * Orchestration pure : vérifie que la session et sa campagne existent, que le demandeur est
 * **éditeur** du groupe (`requireEditor`), que le salon est bien ouvert (`LOBBY`) et que la
 * sélection est non vide et limitée aux membres du groupe. Puis, pour chaque joueur choisi :
 * - inconnu du lobby → une nouvelle invitation `INVITED` ;
 * - `REFUSED` → l'invitation est réarmée par le domaine ({@link SessionParticipant.reinvite}) ;
 * - déjà `INVITED` ou `ACCEPTED` → ignoré, il est déjà dans le lobby (opération idempotente).
 *
 * Écriture en **une seule transaction**, puis notification temps réel : l'invitation apparaît
 * chez chaque joueur convié et le lobby se rafraîchit pour tout le groupe.
 */
export class InviteToLobbyUseCaseImpl implements InviteToLobbyUseCase {
  private readonly sessionRepository: SessionRepository;
  private readonly campaignRepository: CampaignRepository;
  private readonly sessionParticipantRepository: SessionParticipantRepository;
  private readonly groupMemberRepository: GroupMemberRepository;
  private readonly groupAccessService: GroupAccessService;
  private readonly unitOfWork: UnitOfWork;
  private readonly logger: Logger;
  private readonly realtimeNotifier: RealtimeNotifier;

  constructor(deps: InviteToLobbyDeps) {
    this.sessionRepository = deps.sessionRepository;
    this.campaignRepository = deps.campaignRepository;
    this.sessionParticipantRepository = deps.sessionParticipantRepository;
    this.groupMemberRepository = deps.groupMemberRepository;
    this.groupAccessService = deps.groupAccessService;
    this.unitOfWork = deps.unitOfWork;
    this.logger = deps.logger;
    this.realtimeNotifier = deps.realtimeNotifier;
  }

  public async execute(command: InviteToLobbyCommand): Promise<Result<SessionLobbyView, AppError>> {
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

    // On ne convie que dans un salon d'attente ouvert : ni avant (PLANNED), ni une fois la
    // partie lancée (ACTIVE / ENDED). L'ouverture, elle, passe par `CreateLobbyUseCase`.
    if (!session.status.isLobby()) {
      return Result.failure(new LobbyNotOpenError(session.status.value));
    }

    // Dédoublonne la sélection : un même joueur choisi deux fois ne génère qu'une invitation.
    const participantIds = [...new Set(command.participantUserIds)];
    if (participantIds.length === 0) {
      return Result.failure(new EmptyParticipantSelectionError());
    }

    const notInGroup = await this.findNonMember(campaign.groupId, participantIds);
    if (notInGroup !== null) {
      return Result.failure(new ParticipantNotInGroupError(notInGroup));
    }

    const existing = await this.sessionParticipantRepository.findBySessionId(session.id);
    const { created, reinvited } = this.planInvitations(session.id, participantIds, existing);

    if (created.length > 0 || reinvited.length > 0) {
      await this.unitOfWork.execute(async (repos) => {
        await repos.sessionParticipants.saveMany(created);
        for (const participant of reinvited) {
          await repos.sessionParticipants.update(participant);
        }
      });
      this.logger.info("Joueurs conviés à un lobby ouvert", {
        sessionId: session.id,
        campaignId: campaign.id,
        invitedCount: created.length,
        reinvitedCount: reinvited.length,
      });
      this.notify(campaign.groupId, [...created, ...reinvited]);
    }

    // Vue complète du lobby : l'appelant remplace son état d'un bloc plutôt que de fusionner.
    const reinvitedIds = new Set(reinvited.map((participant) => participant.userId));
    const participants = [
      ...existing.filter((participant) => !reinvitedIds.has(participant.userId)),
      ...reinvited,
      ...created,
    ];

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

  /**
   * Cherche, parmi les joueurs choisis, le premier qui n'est pas membre du groupe.
   *
   * @param groupId - Groupe de la campagne parente.
   * @param participantIds - Identifiants des joueurs choisis (dédoublonnés).
   * @returns L'identifiant du premier intrus, ou `null` si tous sont membres.
   */
  private async findNonMember(groupId: string, participantIds: string[]): Promise<string | null> {
    const members = await this.groupMemberRepository.findByGroupId(groupId);
    const memberIds = new Set(members.map((member) => member.userId));
    return participantIds.find((userId) => !memberIds.has(userId)) ?? null;
  }

  /**
   * Répartit les joueurs choisis entre nouvelles invitations et invitations réarmées, en
   * laissant de côté ceux qui sont déjà dans le lobby (`INVITED` / `ACCEPTED`).
   *
   * @param sessionId - Session dont le lobby est ouvert.
   * @param participantIds - Identifiants des joueurs choisis (dédoublonnés, membres du groupe).
   * @param existing - Participations déjà enregistrées sur cette session.
   * @returns Les participations à créer et celles à mettre à jour.
   */
  private planInvitations(
    sessionId: string,
    participantIds: string[],
    existing: SessionParticipant[],
  ): { created: SessionParticipant[]; reinvited: SessionParticipant[] } {
    const existingByUserId = new Map(
      existing.map((participant) => [participant.userId, participant]),
    );
    const invitedAt = new Date();
    const created: SessionParticipant[] = [];
    const reinvited: SessionParticipant[] = [];

    for (const userId of participantIds) {
      const participant = existingByUserId.get(userId);
      if (participant === undefined) {
        created.push(SessionParticipant.create({ sessionId, userId, invitedAt }));
      } else if (participant.status.isRefused()) {
        // Refus accidentel : le domaine réarme l'invitation (REFUSED → INVITED).
        reinvited.push(participant.reinvite({ invitedAt }));
      }
      // Déjà INVITED ou ACCEPTED : rien à faire, le joueur est déjà dans le lobby.
    }

    return { created, reinvited };
  }

  /**
   * Fait apparaître l'invitation chez chaque joueur convié et rafraîchit le lobby de tout le
   * groupe (le MJ voit la ligne repasser « En attente »). Best-effort.
   *
   * @param groupId - Groupe de la campagne parente.
   * @param invited - Participations créées ou réarmées.
   */
  private notify(groupId: string, invited: SessionParticipant[]): void {
    for (const participant of invited) {
      this.realtimeNotifier.notifyUserChanged(participant.userId, "session-invitations");
    }
    this.realtimeNotifier.notifyGroupChanged(groupId, "session-participants");
  }
}
