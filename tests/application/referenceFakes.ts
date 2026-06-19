import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { SheetReferenceLinkRepository } from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";
import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";

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

  public async existsInGroup(groupId: string, itemId: string): Promise<boolean> {
    const item = this.items.get(itemId);
    return item !== undefined && item.isInGroup(groupId);
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

/**
 * Liaison formation ↔ compétences en mémoire. Stocke les paires `formationId::competenceId` et
 * n'expose que les **identifiants** de compétences (le contrat du port).
 */
export class FakeFormationCompetenceLinkRepository implements FormationCompetenceLinkRepository {
  private readonly links = new Set<string>();

  private key(formationId: string, competenceId: string): string {
    return `${formationId}::${competenceId}`;
  }

  public async link(formationId: string, competenceId: string, _createdAt: Date): Promise<void> {
    this.links.add(this.key(formationId, competenceId));
  }

  public async findCompetenceIdsByFormation(formationId: string): Promise<string[]> {
    const prefix = `${formationId}::`;
    return [...this.links].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  }
}
