import { eq } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { users } from "@infrastructure/persistence/drizzle/schema";

/** Représentation brute d'une ligne `users` (type inféré du schema Drizzle). */
export type UserRow = typeof users.$inferSelect;

/** DAO de la table `users` : query builder Drizzle, une seule table, lignes brutes. */
export class UserDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: { id: string; pseudo: string; created_at: Date }): Promise<void> {
    await this.executor.insert(users).values(row);
  }

  public async findById(id: string): Promise<UserRow | null> {
    const rows = await this.executor.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  }
}
