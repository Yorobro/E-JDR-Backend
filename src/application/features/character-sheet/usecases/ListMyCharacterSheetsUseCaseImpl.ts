import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { ListMyCharacterSheetsQuery } from "@application/features/character-sheet/query/ListMyCharacterSheetsQuery";
import { ListMyCharacterSheetsUseCase } from "@application/features/character-sheet/abstractions/usecases/ListMyCharacterSheetsUseCase";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/**
 * Use case « lister mes fiches » (lecture pure).
 *
 * Interroge directement le repository (pas de `UnitOfWork`) puis projette en DTO de lecture.
 */
export class ListMyCharacterSheetsUseCaseImpl implements ListMyCharacterSheetsUseCase {
  constructor(private readonly characterSheetRepository: CharacterSheetRepository) {}

  public async execute(
    query: ListMyCharacterSheetsQuery,
  ): Promise<Result<CharacterSheetSummary[], AppError>> {
    const sheets = await this.characterSheetRepository.findByOwnerId(query.ownerId);

    const summaries: CharacterSheetSummary[] = sheets.map((sheet) => ({
      id: sheet.id,
      ownerId: sheet.ownerId,
      name: sheet.name.value,
      createdAt: sheet.createdAt,
    }));

    return Result.success(summaries);
  }
}
