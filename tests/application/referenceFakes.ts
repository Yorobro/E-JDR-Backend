import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { SheetReferenceLinkRepository } from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";

/** Catalogue d'éléments de référence en mémoire (indexé par id), partagé par les 6 types. */
export class FakeReferenceRepository implements ReferenceRepository {
  private readonly items = new Map<string, ReferenceItem>();

  public async save(item: ReferenceItem): Promise<void> {
    this.items.set(item.id, item);
  }

  public async findByGroupId(groupId: string): Promise<ReferenceItem[]> {
    return [...this.items.values()].filter((item) => item.isInGroup(groupId));
  }

  public async findById(id: string): Promise<ReferenceItem | null> {
    return this.items.get(id) ?? null;
  }

  public async existsByGroupAndName(groupId: string, name: string): Promise<boolean> {
    return [...this.items.values()].some(
      (item) => item.isInGroup(groupId) && item.name.value === name,
    );
  }

  public async deleteById(id: string): Promise<void> {
    this.items.delete(id);
  }

  /** Aide de test : pré-remplit le repository avec un élément. */
  public seed(item: ReferenceItem): void {
    this.items.set(item.id, item);
  }
}

/**
 * Liaison fiche ↔ éléments de référence en mémoire. Stocke les paires `sheetId::itemId` et
 * résout les éléments via le repository d'items fourni (reproduit le JOIN MySQL).
 */
export class FakeSheetReferenceLinkRepository implements SheetReferenceLinkRepository {
  private readonly links = new Set<string>();

  constructor(private readonly itemRepository: FakeReferenceRepository) {}

  private key(sheetId: string, itemId: string): string {
    return `${sheetId}::${itemId}`;
  }

  public async link(sheetId: string, itemId: string): Promise<void> {
    this.links.add(this.key(sheetId, itemId));
  }

  public async unlink(sheetId: string, itemId: string): Promise<void> {
    this.links.delete(this.key(sheetId, itemId));
  }

  public async existsBySheetAndItem(sheetId: string, itemId: string): Promise<boolean> {
    return this.links.has(this.key(sheetId, itemId));
  }

  public async findItemsBySheet(sheetId: string): Promise<ReferenceItem[]> {
    const prefix = `${sheetId}::`;
    const itemIds = [...this.links]
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
    const items: ReferenceItem[] = [];
    for (const id of itemIds) {
      const item = await this.itemRepository.findById(id);
      if (item !== null) {
        items.push(item);
      }
    }
    return items;
  }
}
