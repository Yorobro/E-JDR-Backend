import { SqlExecutor } from "@infrastructure/persistence/mysql/SqlExecutor";
import { TransactionalRepositories } from "@application/shared/IUnitOfWork";
import { UserDao } from "@infrastructure/persistence/mysql/features/auth/dao/UserDao";
import { CredentialDao } from "@infrastructure/persistence/mysql/features/auth/dao/CredentialDao";
import { RefreshTokenDao } from "@infrastructure/persistence/mysql/features/auth/dao/RefreshTokenDao";
import { MysqlUserRepository } from "@infrastructure/persistence/mysql/features/auth/repository/MysqlUserRepository";
import { MysqlCredentialRepository } from "@infrastructure/persistence/mysql/features/auth/repository/MysqlCredentialRepository";
import { MysqlRefreshTokenRepository } from "@infrastructure/persistence/mysql/features/auth/repository/MysqlRefreshTokenRepository";

/**
 * Construit le jeu de repositories auth sur un `SqlExecutor` donné.
 *
 * Point unique de construction des repos : utilisé par le composition root (`main.ts`,
 * sur le pool) ET par le `MysqlUnitOfWork` (sur une connexion transactionnelle). Garantit
 * que les deux modes produisent exactement les mêmes repos, sans duplication de câblage.
 */
export function createAuthRepositories(executor: SqlExecutor): TransactionalRepositories {
  return {
    users: new MysqlUserRepository(new UserDao(executor)),
    credentials: new MysqlCredentialRepository(new CredentialDao(executor)),
    refreshTokens: new MysqlRefreshTokenRepository(new RefreshTokenDao(executor)),
  };
}

