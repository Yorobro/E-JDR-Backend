import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { TransactionalRepositories } from "@application/shared/UnitOfWork";
import { SessionDao } from "@infrastructure/persistence/mysql/features/session/dao/SessionDao";
import { MysqlSessionRepository } from "@infrastructure/persistence/mysql/features/session/repository/MysqlSessionRepository";

/**
 * Construit le jeu de repositories session sur un `DrizzleExecutor` donné.
 *
 * Point unique de construction des repos session : utilisé par le composition root (`main.ts`,
 * sur le pool) ET par le `MysqlUnitOfWork` (sur une connexion transactionnelle). Garantit
 * que les deux modes produisent exactement les mêmes repos, sans duplication de câblage.
 */
export function createSessionRepositories(
  executor: DrizzleExecutor,
): Pick<TransactionalRepositories, "sessions"> {
  return {
    sessions: new MysqlSessionRepository(new SessionDao(executor)),
  };
}
