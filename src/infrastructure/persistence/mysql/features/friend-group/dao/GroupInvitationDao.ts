import { and, eq } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { friendGroups, groupInvitations, users } from "@infrastructure/persistence/drizzle/schema";

export type GroupInvitationRow = typeof groupInvitations.$inferSelect;

export interface PendingInvitationJoinRow {
  id: string;
  group_id: string;
  group_name: string;
  invited_by: string;
  invited_by_pseudo: string;
  created_at: Date;
}

export class GroupInvitationDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    id: string;
    group_id: string;
    invited_user_id: string;
    invited_by: string;
    status: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(groupInvitations).values(row);
  }

  public async findById(id: string): Promise<GroupInvitationRow | null> {
    const rows = await this.executor
      .select()
      .from(groupInvitations)
      .where(eq(groupInvitations.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  public async findPendingByGroupAndUser(
    groupId: string,
    invitedUserId: string,
  ): Promise<GroupInvitationRow | null> {
    const rows = await this.executor
      .select()
      .from(groupInvitations)
      .where(
        and(
          eq(groupInvitations.group_id, groupId),
          eq(groupInvitations.invited_user_id, invitedUserId),
          eq(groupInvitations.status, "PENDING"),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  public async findPendingViewsByInvitedUser(
    invitedUserId: string,
  ): Promise<PendingInvitationJoinRow[]> {
    const rows = await this.executor
      .select({
        id: groupInvitations.id,
        group_id: groupInvitations.group_id,
        group_name: friendGroups.name,
        invited_by: groupInvitations.invited_by,
        invited_by_pseudo: users.pseudo,
        created_at: groupInvitations.created_at,
      })
      .from(groupInvitations)
      .innerJoin(friendGroups, eq(groupInvitations.group_id, friendGroups.id))
      .innerJoin(users, eq(groupInvitations.invited_by, users.id))
      .where(
        and(
          eq(groupInvitations.invited_user_id, invitedUserId),
          eq(groupInvitations.status, "PENDING"),
        ),
      );
    return rows;
  }

  public async updateStatus(id: string, status: string): Promise<void> {
    await this.executor.update(groupInvitations).set({ status }).where(eq(groupInvitations.id, id));
  }

  public async deleteByGroupAndUser(groupId: string, invitedUserId: string): Promise<void> {
    await this.executor
      .delete(groupInvitations)
      .where(
        and(
          eq(groupInvitations.group_id, groupId),
          eq(groupInvitations.invited_user_id, invitedUserId),
        ),
      );
  }
}
