import { eq, desc } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { sessions } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `sessions` (type inféré du schema Drizzle). */
export type SessionRow = typeof sessions.$inferSelect;

/** DAO de la table `sessions` : query builder Drizzle. */
export class SessionDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    id: string;
    campaign_id: string;
    title: string;
    date: Date;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(sessions).values(row);
  }

  public async update(row: { id: string; title: string; date: Date }): Promise<void> {
    await this.executor
      .update(sessions)
      .set({ title: row.title, date: row.date })
      .where(eq(sessions.id, row.id));
  }

  public async findByCampaignId(campaignId: string): Promise<SessionRow[]> {
    return this.executor
      .select()
      .from(sessions)
      .where(eq(sessions.campaign_id, campaignId))
      .orderBy(desc(sessions.date), desc(sessions.created_at));
  }

  public async findById(id: string): Promise<SessionRow | null> {
    const rows = await this.executor.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return rows[0] ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    await this.executor.delete(sessions).where(eq(sessions.id, id));
  }
}
