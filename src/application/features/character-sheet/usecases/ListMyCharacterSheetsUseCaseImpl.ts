import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { ListMyCharacterSheetsQuery } from "@application/features/character-sheet/query/ListMyCharacterSheetsQuery";
import { ListMyCharacterSheetsUseCase } from "@application/features/character-sheet/abstractions/usecases/ListMyCharacterSheetsUseCase";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/**
 * Use case « lister les fiches du groupe actif » (lecture pure).
 *
 * Visibilité « tout le groupe » (D10) : vérifie que le demandeur est membre du groupe, puis liste
 * toutes les fiches du groupe (projetées en DTO de lecture). Pas de `UnitOfWork`.
 */
export class ListMyCharacterSheetsUseCaseImpl implements ListMyCharacterSheetsUseCase {
  constructor(
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly groupAccessService: GroupAccessService,
  ) {}

  public async execute(
    query: ListMyCharacterSheetsQuery,
  ): Promise<Result<CharacterSheetSummary[], AppError>> {
    const memberAccess = await this.groupAccessService.requireMember(query.userId, query.groupId);
    if (memberAccess.isFailure) {
      return Result.failure(memberAccess.error);
    }

    const sheets = await this.characterSheetRepository.findByGroupId(query.groupId);

    const summaries: CharacterSheetSummary[] = sheets.map((sheet) => ({
      id: sheet.id,
      ownerId: sheet.ownerId,
      name: sheet.name.value,
      createdAt: sheet.createdAt,
    }));

    return Result.success(summaries);
  }
}
