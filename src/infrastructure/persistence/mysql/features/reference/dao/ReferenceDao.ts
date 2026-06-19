import { eq, and, desc } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import {
  armes,
  armures,
  competences,
  equipements,
  formations,
  peoples,
} from "@infrastructure/persistence/drizzle/schema";

/**
 * Une **table de référence** Drizzle (toutes ont la même forme : id, group_id, name, created_at).
 * Union des six tables concrètes, pour que le DAO générique accepte n'importe laquelle.
 */
export type ReferenceTable =
  | typeof formations
  | typeof peoples
  | typeof armes
  | typeof armures
  | typeof competences
  | typeof equipements;

/**
 * Ligne brute commune à toutes les tables de référence.
 * Définie explicitement pour couvrir les six tables (dont formations/peoples qui ont des colonnes
 * supplémentaires stat/bonus) sans introduire de mismatch de types dans le DAO générique.
 */
export type ReferenceRow = {
  id: string;
  group_id: string;
  name: string;
  created_at: Date;
  /** Présent uniquement pour formations/peoples ; `null`/absent pour les autres tables. */
  stat?: string | null;
  /** Présent uniquement pour formations/peoples ; `null`/absent pour les autres tables. */
  bonus?: number | null;
};

/**
 * DAO **générique** d'un catalogue d'éléments de référence : une instance par table, la table
 * Drizzle ciblée étant passée au constructeur. Toutes les tables partageant les colonnes
 * `id/group_id/name/created_at`, un seul DAO couvre les six catégories.
 */
export class ReferenceDao {
  constructor(
    private readonly executor: DrizzleExecutor,
    private readonly table: ReferenceTable,
  ) {}

  public async insert(row: {
    id: string;
    group_id: string;
    name: string;
    created_at: Date;
    stat?: string | null;
    bonus?: number | null;
  }): Promise<void> {
    // Cast : les colonnes `stat`/`bonus` n'existent que sur formations/peoples. Sur les autres
    // tables elles sont absentes du type mais simplement ignorées à l'insert (valeurs undefined).
    await this.executor.insert(this.table).values(row as never);
  }

  public async findByGroupId(groupId: string): Promise<ReferenceRow[]> {
    return this.executor
      .select()
      .from(this.table)
      .where(eq(this.table.group_id, groupId))
      .orderBy(desc(this.table.created_at));
  }

  public async findById(id: string): Promise<ReferenceRow | null> {
    const rows = await this.executor
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  public async existsByGroupAndName(groupId: string, name: string): Promise<boolean> {
    const rows = await this.executor
      .select({ one: this.table.id })
      .from(this.table)
      .where(and(eq(this.table.group_id, groupId), eq(this.table.name, name)))
      .limit(1);
    return rows.length > 0;
  }

  public async existsInGroup(groupId: string, id: string): Promise<boolean> {
    const rows = await this.executor
      .select({ one: this.table.id })
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.group_id, groupId)))
      .limit(1);
    return rows.length > 0;
  }

  public async deleteById(id: string): Promise<void> {
    await this.executor.delete(this.table).where(eq(this.table.id, id));
  }
}
