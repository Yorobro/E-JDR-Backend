import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { TransactionalRepositories } from "@application/shared/UnitOfWork";
import { FriendGroupDao } from "@infrastructure/persistence/mysql/features/friend-group/dao/FriendGroupDao";
import { GroupMemberDao } from "@infrastructure/persistence/mysql/features/friend-group/dao/GroupMemberDao";
import { GroupInvitationDao } from "@infrastructure/persistence/mysql/features/friend-group/dao/GroupInvitationDao";
import { MysqlFriendGroupRepository } from "@infrastructure/persistence/mysql/features/friend-group/repository/MysqlFriendGroupRepository";
import { MysqlGroupMemberRepository } from "@infrastructure/persistence/mysql/features/friend-group/repository/MysqlGroupMemberRepository";
import { MysqlGroupInvitationRepository } from "@infrastructure/persistence/mysql/features/friend-group/repository/MysqlGroupInvitationRepository";

export function createFriendGroupRepositories(
  executor: DrizzleExecutor,
): Pick<TransactionalRepositories, "friendGroups" | "groupMembers" | "groupInvitations"> {
  return {
    friendGroups: new MysqlFriendGroupRepository(new FriendGroupDao(executor)),
    groupMembers: new MysqlGroupMemberRepository(new GroupMemberDao(executor)),
    groupInvitations: new MysqlGroupInvitationRepository(new GroupInvitationDao(executor)),
  };
}
