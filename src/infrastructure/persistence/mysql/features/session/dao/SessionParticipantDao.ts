import { eq } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { sessionParticipants } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `session_participants` (type inféré du schema Drizzle). */
export type SessionParticipantRow = typeof sessionParticipants.$inferSelect;

/** Valeurs de colonnes prêtes à insérer dans `session_participants`. */
export type SessionParticipantInsert = typeof sessionParticipants.$inferInsert;

/** DAO de la table `session_participants` : query builder Drizzle. */
export class SessionParticipantDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  /**
   * Insère un lot de participations. Court-circuite si le lot est vide (Drizzle refuse un
   * `VALUES` sans ligne).
   */
  public async insertMany(rows: SessionParticipantInsert[]): Promise<void> {
    if (rows.length === 0) return;
    await this.executor.insert(sessionParticipants).values(rows);
  }

  public async findBySessionId(sessionId: string): Promise<SessionParticipantRow[]> {
    return this.executor
      .select()
      .from(sessionParticipants)
      .where(eq(sessionParticipants.session_id, sessionId));
  }
}
