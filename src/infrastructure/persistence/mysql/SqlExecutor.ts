import { Pool } from "mysql2/promise";

/**
 * Partie commune de `Pool` et `PoolConnection` dont les DAO ont besoin.
 *
 * Les DAO acceptent ce type au lieu d'un `Pool` strict : ils peuvent ainsi exécuter
 * leurs requêtes aussi bien sur le pool (mode normal) que sur une connexion unique
 * ouverte pour une transaction (mode UnitOfWork). Les deux exposent `execute`/`query`.
 */
export type SqlExecutor = Pick<Pool, "execute" | "query">;

