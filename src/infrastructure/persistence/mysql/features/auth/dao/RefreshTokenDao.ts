import { eq, lt } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { refreshTokens } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `refresh_tokens` (type inféré du schema Drizzle). */
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

/** DAO de la table `refresh_tokens` : query builder Drizzle. */
export class RefreshTokenDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    created_at: Date;
  }): Promise<void> {
    await this.executor.insert(refreshTokens).values(row);
  }

  public async findByTokenHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const rows = await this.executor
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token_hash, tokenHash))
      .limit(1);
    return rows[0] ?? null;
  }

  public async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.executor.delete(refreshTokens).where(eq(refreshTokens.token_hash, tokenHash));
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    await this.executor.delete(refreshTokens).where(eq(refreshTokens.user_id, userId));
  }

  public async deleteExpired(now: Date): Promise<void> {
    await this.executor.delete(refreshTokens).where(lt(refreshTokens.expires_at, now));
  }
}
