import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { SheetGroupLookup } from "@application/features/realtime/abstractions/SheetGroupLookup";

/**
 * Implémente {@link SheetGroupLookup} en lisant la fiche via le repo character-sheet.
 * Ne dépend que de `findById` (interface ségrégée).
 */
export class CharacterSheetGroupLookup implements SheetGroupLookup {
  constructor(private readonly repo: Pick<CharacterSheetRepository, "findById">) {}

  public async groupIdOf(sheetId: string): Promise<string | null> {
    const sheet = await this.repo.findById(sheetId);
    return sheet?.groupId ?? null;
  }
}
