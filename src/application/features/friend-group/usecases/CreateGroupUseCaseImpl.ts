import { FriendGroup } from "@domain/features/friend-group/entities/FriendGroup";
import { FriendGroupName } from "@domain/features/friend-group/value-objects/FriendGroupName";
import { GroupMembership } from "@domain/features/friend-group/entities/GroupMembership";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { InvalidGroupNameError } from "@application/features/friend-group/errors/InvalidGroupNameError";
import {
  CreateGroupUseCase,
  CreateGroupCommand,
  CreateGroupResult,
} from "@application/features/friend-group/abstractions/usecases/CreateGroupUseCase";

export class CreateGroupUseCaseImpl implements CreateGroupUseCase {
  constructor(
    private readonly idGenerator: IdGeneratorService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(command: CreateGroupCommand): Promise<Result<CreateGroupResult, AppError>> {
    let name: FriendGroupName;
    try {
      name = FriendGroupName.create(command.name);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidGroupNameError(error.message));
      }
      throw error;
    }

    const group = FriendGroup.create({
      id: this.idGenerator.generate(),
      name,
      createdBy: command.createdBy,
      createdAt: new Date(),
    });

    const membership = GroupMembership.create({
      groupId: group.id,
      userId: command.createdBy,
      role: GroupRole.ADMIN,
      createdAt: new Date(),
    });

    await this.unitOfWork.execute(async (repos) => {
      await repos.friendGroups.save(group);
      await repos.groupMembers.save(membership);
    });

    this.logger.info("Groupe créé", { groupId: group.id, createdBy: group.createdBy });

    return Result.success({ id: group.id, name: group.name.value, createdAt: group.createdAt });
  }
}
