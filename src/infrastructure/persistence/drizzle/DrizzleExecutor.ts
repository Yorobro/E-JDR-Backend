import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "./schema";

/**
 * Exécuteur Drizzle injecté dans les DAOs. Couvre à la fois l'instance hors transaction
 * (`db`) et l'instance transactionnelle (`tx`) fournie par `db.transaction()`, qui partagent
 * la même API de query builder. Remplace l'ancien `SqlExecutor` (mysql2 brut).
 */
export type DrizzleExecutor = MySql2Database<typeof schema>;
