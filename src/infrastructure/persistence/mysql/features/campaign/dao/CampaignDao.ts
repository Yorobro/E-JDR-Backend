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
    game_master_id: string;
    name: string;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(campaigns).values(row);
  }

  public async findByGameMasterId(gameMasterId: string): Promise<CampaignRow[]> {
    return this.executor
      .select()
      .from(campaigns)
      .where(eq(campaigns.game_master_id, gameMasterId))
      .orderBy(desc(campaigns.created_at));
  }

  public async findById(id: string): Promise<CampaignRow | null> {
    const rows = await this.executor.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    return rows[0] ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    await this.executor.delete(campaigns).where(eq(campaigns.id, id));
  }
}
