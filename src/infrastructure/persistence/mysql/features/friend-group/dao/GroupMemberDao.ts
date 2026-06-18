import { and, eq, count } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { groupMembers } from "@infrastructure/persistence/drizzle/schema";

export type GroupMemberRow = typeof groupMembers.$inferSelect;

export class GroupMemberDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    group_id: string;
    user_id: string;
    role: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(groupMembers).values(row);
  }

  public async findByGroupId(groupId: string): Promise<GroupMemberRow[]> {
    return this.executor.select().from(groupMembers).where(eq(groupMembers.group_id, groupId));
  }

  public async findByUserIdAndGroupId(
    userId: string,
    groupId: string,
  ): Promise<GroupMemberRow | null> {
    const rows = await this.executor
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.user_id, userId), eq(groupMembers.group_id, groupId)))
      .limit(1);
    return rows[0] ?? null;
  }

  public async countAdminsByGroupId(groupId: string): Promise<number> {
    const result = await this.executor
      .select({ cnt: count() })
      .from(groupMembers)
      .where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.role, "ADMIN")));
    return result[0]?.cnt ?? 0;
  }

  public async deleteByUserIdAndGroupId(userId: string, groupId: string): Promise<void> {
    await this.executor
      .delete(groupMembers)
      .where(and(eq(groupMembers.user_id, userId), eq(groupMembers.group_id, groupId)));
  }

  public async updateRole(userId: string, groupId: string, role: string): Promise<void> {
    await this.executor
      .update(groupMembers)
      .set({ role })
      .where(and(eq(groupMembers.user_id, userId), eq(groupMembers.group_id, groupId)));
  }
}
