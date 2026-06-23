import { GroupInvitation } from "@domain/features/friend-group/entities/GroupInvitation";
import { InvitationStatus } from "@domain/features/friend-group/value-objects/InvitationStatus";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { tryCreateValueObject } from "@application/shared/tryCreateValueObject";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { Email } from "@domain/features/auth/value-objects/Email";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { GroupInvitationRepository } from "@application/features/friend-group/abstractions/repositories/GroupInvitationRepository";
import { InvitedUserNotFoundError } from "@application/features/friend-group/errors/InvitedUserNotFoundError";
import { AlreadyMemberError } from "@application/features/friend-group/errors/AlreadyMemberError";
import {
  InviteMemberUseCase,
  InviteMemberCommand,
  InviteMemberResult,
} from "@application/features/friend-group/abstractions/usecases/InviteMemberUseCase";

export interface InviteMemberDeps {
  credentialRepository: CredentialRepository;
  groupMemberRepository: GroupMemberRepository;
  groupInvitationRepository: GroupInvitationRepository;
  groupAccessService: GroupAccessService;
  idGenerator: IdGeneratorService;
  unitOfWork: UnitOfWork;
  logger: Logger;
}

export class InviteMemberUseCaseImpl implements InviteMemberUseCase {
  private readonly credentialRepository: CredentialRepository;
  private readonly groupMemberRepository: GroupMemberRepository;
  private readonly groupInvitationRepository: GroupInvitationRepository;
  private readonly groupAccessService: GroupAccessService;
  private readonly idGenerator: IdGeneratorService;
  private readonly unitOfWork: UnitOfWork;
  private readonly logger: Logger;

  constructor(deps: InviteMemberDeps) {
    this.credentialRepository = deps.credentialRepository;
    this.groupMemberRepository = deps.groupMemberRepository;
    this.groupInvitationRepository = deps.groupInvitationRepository;
    this.groupAccessService = deps.groupAccessService;
    this.idGenerator = deps.idGenerator;
    this.unitOfWork = deps.unitOfWork;
    this.logger = deps.logger;
  }

  public async execute(
    command: InviteMemberCommand,
  ): Promise<Result<InviteMemberResult, AppError>> {
    const accessResult = await this.groupAccessService.requireMember(
      command.invitedByUserId,
      command.groupId,
    );
    if (accessResult.isFailure) return Result.failure(accessResult.error);

    // Un e-mail SYNTAXIQUEMENT invalide est une entrée invalide (→ 400 INVALID_EMAIL).
    // En revanche, un e-mail bien formé mais sans compte associé reste un 404 volontairement
    // indifférencié (InvitedUserNotFound) pour ne pas révéler l'existence d'un compte (anti-énumération).
    const emailResult = tryCreateValueObject(() => Email.create(command.inviteeEmail));
    if (emailResult.isFailure) return Result.failure(emailResult.error);
    const email = emailResult.value;

    const credential = await this.credentialRepository.findByEmail(email);
    if (credential === null) return Result.failure(new InvitedUserNotFoundError());

    const invitedUserId = credential.userId;

    const existingMembership = await this.groupMemberRepository.findByUserIdAndGroupId(
      invitedUserId,
      command.groupId,
    );
    if (existingMembership !== null) return Result.failure(new AlreadyMemberError());

    const existingInvitation = await this.groupInvitationRepository.findPendingByGroupAndUser(
      command.groupId,
      invitedUserId,
    );
    if (existingInvitation !== null) return Result.failure(new AlreadyMemberError());

    const invitation = GroupInvitation.create({
      id: this.idGenerator.generate(),
      groupId: command.groupId,
      invitedUserId,
      invitedBy: command.invitedByUserId,
      status: InvitationStatus.PENDING,
      createdAt: new Date(),
    });

    await this.unitOfWork.execute(async (repos) => {
      // Purge une éventuelle invitation déjà résolue (ACCEPTED/DECLINED) pour ce couple : la
      // contrainte d'unicité `(group_id, invited_user_id)` ignore le statut, donc sans cette
      // suppression la réinvitation après un refus/retrait violerait la contrainte (cf. #réinvitation).
      // Le cas PENDING a déjà été écarté plus haut, on ne supprime donc qu'une ligne résolue.
      await repos.groupInvitations.deleteByGroupAndUser(command.groupId, invitedUserId);
      await repos.groupInvitations.save(invitation);
    });

    this.logger.info("Invitation envoyée", {
      invitationId: invitation.id,
      groupId: invitation.groupId,
      invitedUserId,
    });

    return Result.success({ invitationId: invitation.id });
  }
}
