import mysql, { Pool, PoolOptions } from "mysql2/promise";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@infrastructure/persistence/drizzle/schema";

/**
 * Encapsule le pool MySQL (`mysql2`) et l'instance Drizzle construite par-dessus.
 *
 * `mysql2` reste le driver bas niveau (protocole, pool) ; Drizzle s'appuie dessus pour le
 * query builder typé. Tous les DAO reçoivent l'instance `db` (ou une transaction dérivée).
 */
export class MysqlConnection {
  private readonly pool: Pool;
  private readonly db: MySql2Database<typeof schema>;

  constructor(options: PoolOptions) {
    this.pool = mysql.createPool(options);
    this.db = drizzle(this.pool, { schema, mode: "default" });
  }

  /** Donne accès à l'instance Drizzle (mode normal, hors transaction). */
  public getDb(): MySql2Database<typeof schema> {
    return this.db;
  }

  /** Donne accès au pool sous-jacent (migrations, fixtures de test). */
  public getPool(): Pool {
    return this.pool;
  }

  /** Ferme proprement le pool (à l'arrêt de l'application). */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}
