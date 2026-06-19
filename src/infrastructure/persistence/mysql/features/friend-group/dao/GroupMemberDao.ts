import { and, eq, count } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { groupMembers, users } from "@infrastructure/persistence/drizzle/schema";

export type GroupMemberRow = typeof groupMembers.$inferSelect;

/** Vue d'un membre enrichie du pseudo (jointure users), pour l'affichage. */
export interface GroupMemberViewRow {
  user_id: string;
  pseudo: string;
  role: string;
  created_at: Date;
}

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

  /** Membres d'un groupe avec leur pseudo (jointure users), pour l'affichage. */
  public async findViewsByGroupId(groupId: string): Promise<GroupMemberViewRow[]> {
    return this.executor
      .select({
        user_id: groupMembers.user_id,
        pseudo: users.pseudo,
        role: groupMembers.role,
        created_at: groupMembers.created_at,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.user_id, users.id))
      .where(eq(groupMembers.group_id, groupId));
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
