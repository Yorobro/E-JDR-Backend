import { eq, desc } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { sessions } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `sessions` (type inféré du schema Drizzle). */
export type SessionRow = typeof sessions.$inferSelect;

/** Valeurs de colonnes prêtes à insérer dans `sessions` (type inféré du schema Drizzle). */
export type SessionInsert = typeof sessions.$inferInsert;

/** DAO de la table `sessions` : query builder Drizzle. */
export class SessionDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: SessionInsert): Promise<void> {
    await this.executor.insert(sessions).values(row);
  }

  /**
   * Met à jour les champs mutables d'une session : titre, date, **statut** et **date de
   * démarrage**. Le statut et `started_at` évoluent au fil des transitions du cycle de vie
   * (ouverture du lobby, démarrage de la partie).
   */
  public async update(row: {
    id: string;
    title: string;
    date: Date;
    status: string;
    started_at: Date | null;
  }): Promise<void> {
    await this.executor
      .update(sessions)
      .set({ title: row.title, date: row.date, status: row.status, started_at: row.started_at })
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
