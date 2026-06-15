import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { TransactionalRepositories } from "@application/shared/UnitOfWork";
import { CharacterSheetDao } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";
import { CampaignCharacterDao } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CampaignCharacterDao";
import { MysqlCharacterSheetRepository } from "@infrastructure/persistence/mysql/features/character-sheet/repository/MysqlCharacterSheetRepository";
import { MysqlCampaignCharacterRepository } from "@infrastructure/persistence/mysql/features/character-sheet/repository/MysqlCampaignCharacterRepository";

/**
 * Construit le jeu de repositories du sous-domaine fiches (la fiche + la liaison N-N) sur un
 * `DrizzleExecutor` donné.
 *
 * Point unique de construction : utilisé par le composition root (`main.ts`, sur le pool) ET
 * par le `MysqlUnitOfWork` (sur une connexion transactionnelle).
 */
export function createCharacterSheetRepositories(
  executor: DrizzleExecutor,
): Pick<TransactionalRepositories, "characterSheets" | "campaignCharacters"> {
  return {
    characterSheets: new MysqlCharacterSheetRepository(new CharacterSheetDao(executor)),
    campaignCharacters: new MysqlCampaignCharacterRepository(new CampaignCharacterDao(executor)),
  };
}
