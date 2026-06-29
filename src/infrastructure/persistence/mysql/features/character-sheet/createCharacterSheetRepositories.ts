import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { TransactionalRepositories } from "@application/shared/UnitOfWork";
import { CharacterSheetDao } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";
import { MysqlCharacterSheetRepository } from "@infrastructure/persistence/mysql/features/character-sheet/repository/MysqlCharacterSheetRepository";

/**
 * Construit le repository du sous-domaine fiches (modèle « une fiche = une campagne » : la
 * campagne est un attribut de la fiche, plus de table de liaison N‑N) sur un `DrizzleExecutor`.
 *
 * Point unique de construction : utilisé par le composition root (`main.ts`, sur le pool) ET
 * par le `MysqlUnitOfWork` (sur une connexion transactionnelle).
 */
export function createCharacterSheetRepositories(
  executor: DrizzleExecutor,
): Pick<TransactionalRepositories, "characterSheets"> {
  return {
    characterSheets: new MysqlCharacterSheetRepository(new CharacterSheetDao(executor)),
  };
}
