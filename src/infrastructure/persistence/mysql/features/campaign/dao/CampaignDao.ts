import { eq, desc } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { campaigns } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `campaigns` (type inféré du schema Drizzle). */
export type CampaignRow = typeof campaigns.$inferSelect;

/** DAO de la table `campaigns` : query builder Drizzle. */
export class CampaignDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    id: string;
    group_id: string;
    game_master_id: string;
    name: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(campaigns).values(row);
  }

  public async findByGroupId(groupId: string): Promise<CampaignRow[]> {
    return this.executor
      .select()
      .from(campaigns)
      .where(eq(campaigns.group_id, groupId))
      .orderBy(desc(campaigns.created_at));
  }

  public async existsByGroupId(groupId: string): Promise<boolean> {
    const rows = await this.executor
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.group_id, groupId))
      .limit(1);
    return rows.length > 0;
  }

  public async findById(id: string): Promise<CampaignRow | null> {
    const rows = await this.executor.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    return rows[0] ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    await this.executor.delete(campaigns).where(eq(campaigns.id, id));
  }
}
