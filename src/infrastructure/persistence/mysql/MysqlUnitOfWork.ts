import { MysqlConnection } from "@infrastructure/persistence/mysql/MysqlConnection";
import { createAuthRepositories } from "@infrastructure/persistence/mysql/features/auth/createAuthRepositories";
import { IUnitOfWork, TransactionalRepositories } from "@application/shared/IUnitOfWork";

/**
 * Implémentation MySQL du `UnitOfWork`.
 *
 * Ouvre une connexion dédiée depuis le pool, démarre une transaction, construit les repos
 * liés à cette connexion, exécute le callback, puis valide (commit) ou annule (rollback)
 * selon que le callback réussit ou lève. La connexion est toujours rendue au pool (finally).
 */
export class MysqlUnitOfWork implements IUnitOfWork {
  constructor(private readonly connection: MysqlConnection) {}

  public async execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    const conn = await this.connection.getPool().getConnection();
    await conn.beginTransaction();
    try {
      const result = await work(createAuthRepositories(conn));
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}


