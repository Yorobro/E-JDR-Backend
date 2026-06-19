import { eq, and, desc, sql } from "drizzle-orm";
import { MySqlColumn } from "drizzle-orm/mysql-core";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import {
  armes,
  armures,
  competences,
  equipements,
  sheetArmes,
  sheetArmures,
  sheetCompetences,
  sheetEquipements,
} from "@infrastructure/persistence/drizzle/schema";
import { ReferenceRow } from "@infrastructure/persistence/mysql/features/reference/dao/ReferenceDao";

/** Une table de jointure fiche ↔ référence (toutes ont `sheet_id`, `<x>_id`, `created_at`). */
export type SheetLinkTable =
  | typeof sheetArmes
  | typeof sheetArmures
  | typeof sheetCompetences
  | typeof sheetEquipements;

/** La table de référence liée (pour résoudre les éléments rattachés via JOIN). */
export type LinkedReferenceTable =
  | typeof armes
  | typeof armures
  | typeof competences
  | typeof equipements;

/**
 * Décrit une liaison N‑N : la table de jointure, sa colonne « item » (`arme_id`, `armure_id`…),
 * et la table de référence liée. Permet au DAO générique de couvrir les quatre catégories sans
 * dupliquer la logique SQL.
 */
export interface SheetLinkBinding {
  readonly joinTable: SheetLinkTable;
  readonly itemIdColumn: MySqlColumn;
  readonly referenceTable: LinkedReferenceTable;
}

/**
 * DAO **générique** d'une liaison N‑N fiche ↔ éléments de référence, paramétré par un
 * {@link SheetLinkBinding}. La colonne « item » variant selon la catégorie (`arme_id`…), on cible
 * la table de jointure et sa colonne via le binding ; quelques `cast` ponctuels lèvent l'ambiguïté
 * de types que Drizzle ne peut pas inférer sur une union de tables.
 */
export class SheetReferenceLinkDao {
  constructor(
    private readonly executor: DrizzleExecutor,
    private readonly binding: SheetLinkBinding,
  ) {}

  public async insert(sheetId: string, itemId: string, createdAt: Date): Promise<void> {
    const values = {
      sheet_id: sheetId,
      [this.binding.itemIdColumn.name]: itemId,
      created_at: createdAt,
    };
    // Cast : la forme exacte de l'insert dépend de la table concrète (colonne item variable).
    await this.executor.insert(this.binding.joinTable).values(values as never);
  }

  public async delete(sheetId: string, itemId: string): Promise<void> {
    await this.executor
      .delete(this.binding.joinTable)
      .where(
        and(eq(this.binding.joinTable.sheet_id, sheetId), eq(this.binding.itemIdColumn, itemId)),
      );
  }

  public async exists(sheetId: string, itemId: string): Promise<boolean> {
    const rows = await this.executor
      .select({ one: sql<number>`1` })
      .from(this.binding.joinTable)
      .where(
        and(eq(this.binding.joinTable.sheet_id, sheetId), eq(this.binding.itemIdColumn, itemId)),
      )
      .limit(1);
    return rows.length > 0;
  }

  public async findItemsBySheet(sheetId: string): Promise<ReferenceRow[]> {
    const refTable = this.binding.referenceTable;
    const join = this.binding.joinTable;
    const rows = await this.executor
      .select({
        id: refTable.id,
        group_id: refTable.group_id,
        name: refTable.name,
        created_at: refTable.created_at,
      })
      .from(join)
      .innerJoin(refTable, eq(this.binding.itemIdColumn, refTable.id))
      .where(eq(join.sheet_id, sheetId))
      .orderBy(desc(join.created_at));
    return rows;
  }
}
