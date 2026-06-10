import mysql, { Pool, PoolOptions } from "mysql2/promise";

/**
 * Encapsule la création et l'accès au pool de connexions MySQL (via `mysql2/promise`).
 *
 * Le pool est partagé par tous les DAO : il gère l'ouverture/fermeture des connexions et
 * leur réutilisation. Cette classe est le seul point de l'infrastructure qui connaît la
 * configuration de connexion.
 */
export class MysqlConnection {
  /** Le pool de connexions sous-jacent. */
  private readonly pool: Pool;

  /**
   * @param options - Les options de connexion MySQL (hôte, port, identifiants, base...).
   */
  constructor(options: PoolOptions) {
    this.pool = mysql.createPool(options);
  }

  /**
   * Donne accès au pool de connexions pour l'exécution des requêtes.
   *
   * @returns Le pool `mysql2/promise`.
   */
  public getPool(): Pool {
    return this.pool;
  }

  /**
   * Ferme proprement le pool de connexions (à appeler à l'arrêt de l'application).
   *
   * @returns Une promesse résolue une fois le pool fermé.
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}

