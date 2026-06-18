import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { SheetReferenceLinkRepository } from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";
import { SheetReferenceLinkDao } from "@infrastructure/persistence/mysql/features/reference/dao/SheetReferenceLinkDao";
import { ReferenceMapper } from "@infrastructure/persistence/mysql/features/reference/mappers/ReferenceMapper";

/**
 * Implémentation MySQL **générique** du port `SheetReferenceLinkRepository` : assemble un
 * `SheetReferenceLinkDao` (lié à une table de jointure) et le `ReferenceMapper`. Une instance par
 * catégorie liable (arme/armure/compétence/équipement).
 */
export class MysqlSheetReferenceLinkRepository implements SheetReferenceLinkRepository {
  constructor(private readonly dao: SheetReferenceLinkDao) {}

  public async link(sheetId: string, itemId: string, createdAt: Date): Promise<void> {
    await this.dao.insert(sheetId, itemId, createdAt);
  }

  public async unlink(sheetId: string, itemId: string): Promise<void> {
    await this.dao.delete(sheetId, itemId);
  }

  public async existsBySheetAndItem(sheetId: string, itemId: string): Promise<boolean> {
    return this.dao.exists(sheetId, itemId);
  }

  public async findItemsBySheet(sheetId: string): Promise<ReferenceItem[]> {
    const rows = await this.dao.findItemsBySheet(sheetId);
    return rows.map((row) => ReferenceMapper.toDomain(row));
  }
}
