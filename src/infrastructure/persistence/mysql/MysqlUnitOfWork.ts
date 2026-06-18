import { MysqlConnection } from "@infrastructure/persistence/mysql/MysqlConnection";
import { createAuthRepositories } from "@infrastructure/persistence/mysql/features/auth/createAuthRepositories";
import { createCampaignRepositories } from "@infrastructure/persistence/mysql/features/campaign/createCampaignRepositories";
import { createSessionRepositories } from "@infrastructure/persistence/mysql/features/session/createSessionRepositories";
import { createCharacterSheetRepositories } from "@infrastructure/persistence/mysql/features/character-sheet/createCharacterSheetRepositories";
import { createReferenceRepositories } from "@infrastructure/persistence/mysql/features/reference/createReferenceRepositories";
import { UnitOfWork, TransactionalRepositories } from "@application/shared/UnitOfWork";

/**
 * Implémentation du `UnitOfWork` basée sur les transactions Drizzle.
 *
 * `db.transaction(cb)` ouvre une transaction, fournit un exécuteur transactionnel `tx`,
 * commit si `cb` réussit et rollback s'il lève. La règle « toute écriture passe par le UoW »
 * est préservée : les repos construits ici sont liés à `tx`.
 */
export class MysqlUnitOfWork implements UnitOfWork {
  constructor(private readonly connection: MysqlConnection) {}

  public async execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    return this.connection.getDb().transaction(async (tx) => {
      const repos: TransactionalRepositories = {
        ...createAuthRepositories(tx),
        ...createCampaignRepositories(tx),
        ...createSessionRepositories(tx),
        ...createCharacterSheetRepositories(tx),
        ...createReferenceRepositories(tx),
      };
      return work(repos);
    });
  }
}
