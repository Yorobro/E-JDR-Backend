import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { TransactionalRepositories } from "@application/shared/UnitOfWork";
import {
  armes,
  armures,
  competences,
  equipements,
  formations,
  peoples,
  sheetArmes,
  sheetArmures,
  sheetCompetences,
  sheetEquipements,
} from "@infrastructure/persistence/drizzle/schema";
import { ReferenceDao } from "@infrastructure/persistence/mysql/features/reference/dao/ReferenceDao";
import { SheetReferenceLinkDao } from "@infrastructure/persistence/mysql/features/reference/dao/SheetReferenceLinkDao";
import { MysqlReferenceRepository } from "@infrastructure/persistence/mysql/features/reference/repository/MysqlReferenceRepository";
import { MysqlSheetReferenceLinkRepository } from "@infrastructure/persistence/mysql/features/reference/repository/MysqlSheetReferenceLinkRepository";

/** Sous-ensemble de `TransactionalRepositories` produit par ce module (catalogues + liaisons). */
type ReferenceRepositories = Pick<
  TransactionalRepositories,
  | "formations"
  | "peoples"
  | "armes"
  | "armures"
  | "competences"
  | "equipements"
  | "sheetArmes"
  | "sheetArmures"
  | "sheetCompetences"
  | "sheetEquipements"
>;

/**
 * Construit les 10 repositories de la feature référence (6 catalogues + 4 liaisons N‑N) sur un
 * `DrizzleExecutor` donné. Chaque repository est une instance du repository générique paramétrée
 * par la table Drizzle correspondante. Utilisé par le composition root (pool) et le `UnitOfWork`
 * (transaction), comme les autres factories.
 */
export function createReferenceRepositories(executor: DrizzleExecutor): ReferenceRepositories {
  return {
    formations: new MysqlReferenceRepository(new ReferenceDao(executor, formations)),
    peoples: new MysqlReferenceRepository(new ReferenceDao(executor, peoples)),
    armes: new MysqlReferenceRepository(new ReferenceDao(executor, armes)),
    armures: new MysqlReferenceRepository(new ReferenceDao(executor, armures)),
    competences: new MysqlReferenceRepository(new ReferenceDao(executor, competences)),
    equipements: new MysqlReferenceRepository(new ReferenceDao(executor, equipements)),
    sheetArmes: new MysqlSheetReferenceLinkRepository(
      new SheetReferenceLinkDao(executor, {
        joinTable: sheetArmes,
        itemIdColumn: sheetArmes.arme_id,
        referenceTable: armes,
      }),
    ),
    sheetArmures: new MysqlSheetReferenceLinkRepository(
      new SheetReferenceLinkDao(executor, {
        joinTable: sheetArmures,
        itemIdColumn: sheetArmures.armure_id,
        referenceTable: armures,
      }),
    ),
    sheetCompetences: new MysqlSheetReferenceLinkRepository(
      new SheetReferenceLinkDao(executor, {
        joinTable: sheetCompetences,
        itemIdColumn: sheetCompetences.competence_id,
        referenceTable: competences,
      }),
    ),
    sheetEquipements: new MysqlSheetReferenceLinkRepository(
      new SheetReferenceLinkDao(executor, {
        joinTable: sheetEquipements,
        itemIdColumn: sheetEquipements.equipement_id,
        referenceTable: equipements,
      }),
    ),
  };
}
