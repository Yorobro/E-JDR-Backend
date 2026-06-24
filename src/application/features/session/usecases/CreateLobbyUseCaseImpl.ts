import { DomainError } from "@domain/shared/errors/DomainError";
import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { EmptyParticipantSelectionError } from "@application/features/session/errors/EmptyParticipantSelectionError";
import { ParticipantNotInGroupError } from "@application/features/session/errors/ParticipantNotInGroupError";
import { CreateLobbyCommand } from "@application/features/session/commands/CreateLobbyCommand";
import {
  CreateLobbyUseCase,
  SessionLobbyView,
} from "@application/features/session/abstractions/usecases/CreateLobbyUseCase";

/**
 * Use case d'ouverture du lobby d'une session.
 *
 * Orchestration pure : vérifie que la session et sa campagne existent, que le demandeur est
 * **éditeur** du groupe (`requireEditor`), que la sélection de joueurs est non vide et limitée
 * aux membres du groupe, puis demande au domaine la transition `PLANNED → LOBBY`
 * ({@link Session.openLobby}) et persiste — dans une **seule transaction** — la session mise à
 * jour et les invitations (`SessionParticipant` au statut `INVITED`). La règle de transition
 * d'état vit dans le domaine, pas ici.
 */
export class CreateLobbyUseCaseImpl implements CreateLobbyUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly groupMemberRepository: GroupMemberRepository,
    private readonly groupAccessService: GroupAccessService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(command: CreateLobbyCommand): Promise<Result<SessionLobbyView, AppError>> {
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

    // Dédoublonne la sélection : un même joueur coché deux fois ne génère qu'une invitation.
    const participantIds = [...new Set(command.participantUserIds)];
    if (participantIds.length === 0) {
      return Result.failure(new EmptyParticipantSelectionError());
    }

    // Tous les joueurs choisis doivent être membres du groupe de la campagne.
    const members = await this.groupMemberRepository.findByGroupId(campaign.groupId);
    const memberIds = new Set(members.map((member) => member.userId));
    for (const userId of participantIds) {
      if (!memberIds.has(userId)) {
        return Result.failure(new ParticipantNotInGroupError(userId));
      }
    }

    // Transition métier portée par l'entité : échoue si la session n'est pas PLANNED.
    let inLobby;
    try {
      inLobby = session.openLobby();
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    const invitedAt = new Date();
    const participants = participantIds.map((userId) =>
      SessionParticipant.create({ sessionId: session.id, userId, invitedAt }),
    );

    await this.unitOfWork.execute(async (repos) => {
      await repos.sessions.update(inLobby);
      await repos.sessionParticipants.saveMany(participants);
    });

    this.logger.info("Lobby ouvert", {
      sessionId: session.id,
      campaignId: campaign.id,
      participantCount: participants.length,
    });

    return Result.success({
      sessionId: inLobby.id,
      campaignId: inLobby.campaignId,
      status: inLobby.status.value,
      participants: participants.map((participant) => ({
        userId: participant.userId,
        status: participant.status.value,
        characterSheetId: participant.characterSheetId,
      })),
    });
  }
}
