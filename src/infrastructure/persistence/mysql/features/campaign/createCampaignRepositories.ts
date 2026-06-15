import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { TransactionalRepositories } from "@application/shared/UnitOfWork";
import { CampaignDao } from "@infrastructure/persistence/mysql/features/campaign/dao/CampaignDao";
import { MysqlCampaignRepository } from "@infrastructure/persistence/mysql/features/campaign/repository/MysqlCampaignRepository";

/**
 * Construit le jeu de repositories campaign sur un `SqlExecutor` donné.
 *
 * Point unique de construction des repos campaign : utilisé par le composition root (`main.ts`,
 * sur le pool) ET par le `MysqlUnitOfWork` (sur une connexion transactionnelle). Garantit
 * que les deux modes produisent exactement les mêmes repos, sans duplication de câblage.
 */
export function createCampaignRepositories(
  executor: DrizzleExecutor,
): Pick<TransactionalRepositories, "campaigns"> {
  return {
    campaigns: new MysqlCampaignRepository(new CampaignDao(executor)),
  };
}
