import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { FriendGroupRepository } from "@application/features/friend-group/abstractions/repositories/FriendGroupRepository";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { GroupInvitationRepository } from "@application/features/friend-group/abstractions/repositories/GroupInvitationRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { CreateGroupUseCaseImpl } from "@application/features/friend-group/usecases/CreateGroupUseCaseImpl";
import { GetGroupUseCaseImpl } from "@application/features/friend-group/usecases/GetGroupUseCaseImpl";
import { ListMyGroupsUseCaseImpl } from "@application/features/friend-group/usecases/ListMyGroupsUseCaseImpl";
import { DeleteGroupUseCaseImpl } from "@application/features/friend-group/usecases/DeleteGroupUseCaseImpl";
import {
  InviteMemberUseCaseImpl,
  type InviteMemberDeps,
} from "@application/features/friend-group/usecases/InviteMemberUseCaseImpl";
import { ListMyInvitationsUseCaseImpl } from "@application/features/friend-group/usecases/ListMyInvitationsUseCaseImpl";
import { AcceptInvitationUseCaseImpl } from "@application/features/friend-group/usecases/AcceptInvitationUseCaseImpl";
import { DeclineInvitationUseCaseImpl } from "@application/features/friend-group/usecases/DeclineInvitationUseCaseImpl";
import { RemoveMemberUseCaseImpl } from "@application/features/friend-group/usecases/RemoveMemberUseCaseImpl";
import { ChangeMemberRoleUseCaseImpl } from "@application/features/friend-group/usecases/ChangeMemberRoleUseCaseImpl";
import { GroupController } from "@presentation/http/features/friend-group/controllers/GroupController";
import { InvitationController } from "@presentation/http/features/friend-group/controllers/InvitationController";

export interface GroupControllerDeps {
  friendGroupRepository: FriendGroupRepository;
  groupMemberRepository: GroupMemberRepository;
  groupInvitationRepository: GroupInvitationRepository;
  campaignRepository: CampaignRepository;
  characterSheetRepository: CharacterSheetRepository;
  credentialRepository: CredentialRepository;
  idGenerator: IdGeneratorService;
  unitOfWork: UnitOfWork;
  logger: Logger;
}

export function buildGroupControllers(deps: GroupControllerDeps): {
  group: GroupController;
  invitation: InvitationController;
  groupAccessService: GroupAccessService;
} {
  const groupAccessService = new GroupAccessServiceImpl(
    deps.groupMemberRepository,
    deps.campaignRepository,
    deps.characterSheetRepository,
  );

  const groupController = new GroupController(
    new CreateGroupUseCaseImpl(deps.idGenerator, deps.unitOfWork, deps.logger),
    new GetGroupUseCaseImpl(
      deps.friendGroupRepository,
      deps.groupMemberRepository,
      groupAccessService,
    ),
    new ListMyGroupsUseCaseImpl(deps.friendGroupRepository, deps.groupMemberRepository),
    new DeleteGroupUseCaseImpl(
      deps.friendGroupRepository,
      deps.campaignRepository,
      groupAccessService,
      deps.unitOfWork,
      deps.logger,
    ),
    new RemoveMemberUseCaseImpl(
      deps.groupMemberRepository,
      groupAccessService,
      deps.unitOfWork,
      deps.logger,
    ),
    new ChangeMemberRoleUseCaseImpl(
      deps.groupMemberRepository,
      groupAccessService,
      deps.unitOfWork,
      deps.logger,
    ),
  );

  const invitationController = new InvitationController(
    new InviteMemberUseCaseImpl({
      credentialRepository: deps.credentialRepository,
      groupMemberRepository: deps.groupMemberRepository,
      groupInvitationRepository: deps.groupInvitationRepository,
      groupAccessService,
      idGenerator: deps.idGenerator,
      unitOfWork: deps.unitOfWork,
      logger: deps.logger,
    } satisfies InviteMemberDeps),
    new ListMyInvitationsUseCaseImpl(deps.groupInvitationRepository),
    new AcceptInvitationUseCaseImpl(deps.groupInvitationRepository, deps.unitOfWork, deps.logger),
    new DeclineInvitationUseCaseImpl(deps.groupInvitationRepository, deps.unitOfWork, deps.logger),
  );

  return { group: groupController, invitation: invitationController, groupAccessService };
}
