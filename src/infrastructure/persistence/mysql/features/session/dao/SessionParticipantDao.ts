import { and, eq } from "drizzle-orm";
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

  public async findBySessionIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<SessionParticipantRow | null> {
    const rows = await this.executor
      .select()
      .from(sessionParticipants)
      .where(
        and(eq(sessionParticipants.session_id, sessionId), eq(sessionParticipants.user_id, userId)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  public async findInvitedByUserId(userId: string): Promise<SessionParticipantRow[]> {
    return this.executor
      .select()
      .from(sessionParticipants)
      .where(
        and(eq(sessionParticipants.user_id, userId), eq(sessionParticipants.status, "INVITED")),
      );
  }

  /**
   * Met à jour l'état d'une participation existante : `status` et `responded_at`, ciblés par la
   * clé composite `(session_id, user_id)`. Les colonnes d'invitation (`invited_at`) ne bougent pas.
   */
  public async update(row: {
    session_id: string;
    user_id: string;
    status: string;
    responded_at: Date | null;
  }): Promise<void> {
    await this.executor
      .update(sessionParticipants)
      .set({ status: row.status, responded_at: row.responded_at })
      .where(
        and(
          eq(sessionParticipants.session_id, row.session_id),
          eq(sessionParticipants.user_id, row.user_id),
        ),
      );
  }

  /**
   * Supprime une participation par son identifiant composé.
   *
   * @param sessionId - Identifiant de la session.
   * @param userId - Identifiant du joueur.
   */
  public async deleteById(sessionId: string, userId: string): Promise<void> {
    await this.executor
      .delete(sessionParticipants)
      .where(
        and(eq(sessionParticipants.session_id, sessionId), eq(sessionParticipants.user_id, userId)),
      );
  }
}
