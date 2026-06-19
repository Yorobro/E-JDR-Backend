import { eq, inArray } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { friendGroups, groupMembers } from "@infrastructure/persistence/drizzle/schema";

export type FriendGroupRow = typeof friendGroups.$inferSelect;

export class FriendGroupDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    id: string;
    name: string;
    created_by: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(friendGroups).values(row);
  }

  public async findById(id: string): Promise<FriendGroupRow | null> {
    const rows = await this.executor
      .select()
      .from(friendGroups)
      .where(eq(friendGroups.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  public async findByMemberId(userId: string): Promise<FriendGroupRow[]> {
    const memberRows = await this.executor
      .select({ group_id: groupMembers.group_id })
      .from(groupMembers)
      .where(eq(groupMembers.user_id, userId));

    if (memberRows.length === 0) return [];

    const groupIds = memberRows.map((r) => r.group_id);
    return this.executor.select().from(friendGroups).where(inArray(friendGroups.id, groupIds));
  }

  public async deleteById(id: string): Promise<void> {
    await this.executor.delete(friendGroups).where(eq(friendGroups.id, id));
  }
}
