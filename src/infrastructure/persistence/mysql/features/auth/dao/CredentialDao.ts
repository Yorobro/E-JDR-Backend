import { eq } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { credentials } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `credentials` (type inféré du schema Drizzle). */
export type CredentialRow = typeof credentials.$inferSelect;

/** DAO de la table `credentials` : query builder Drizzle. */
export class CredentialDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    id: string;
    user_id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    failed_attempts: number;
    locked_until: Date | null;
  }): Promise<void> {
    await this.executor.insert(credentials).values(row);
  }

  public async findByEmail(email: string): Promise<CredentialRow | null> {
    const rows = await this.executor
      .select()
      .from(credentials)
      .where(eq(credentials.email, email))
      .limit(1);
    return rows[0] ?? null;
  }

  public async findByUserId(userId: string): Promise<CredentialRow | null> {
    const rows = await this.executor
      .select()
      .from(credentials)
      .where(eq(credentials.user_id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  public async existsByEmail(email: string): Promise<boolean> {
    const rows = await this.executor
      .select({ id: credentials.id })
      .from(credentials)
      .where(eq(credentials.email, email))
      .limit(1);
    return rows.length > 0;
  }

  public async update(
    id: string,
    data: { failed_attempts: number; locked_until: Date | null },
  ): Promise<void> {
    await this.executor
      .update(credentials)
      .set({ failed_attempts: data.failed_attempts, locked_until: data.locked_until })
      .where(eq(credentials.id, id));
  }
}
