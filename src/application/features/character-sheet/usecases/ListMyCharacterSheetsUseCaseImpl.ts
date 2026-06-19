import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { ListMyCharacterSheetsQuery } from "@application/features/character-sheet/query/ListMyCharacterSheetsQuery";
import { ListMyCharacterSheetsUseCase } from "@application/features/character-sheet/abstractions/usecases/ListMyCharacterSheetsUseCase";
import { CharacterSheetSummary } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetSummary";

/**
 * Use case « lister MES fiches dans le groupe actif » (lecture pure).
 *
 * Vérifie que le demandeur est membre du groupe, puis liste les fiches **du groupe actif dont il
 * est propriétaire** (et non plus toutes les fiches du groupe) : l'écran « Mes fiches » ne montre
 * que les fiches créées par l'utilisateur. L'accès du MJ aux fiches de ses joueurs passera par
 * l'écran de campagne (hors de ce listing). Pas de `UnitOfWork`.
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

    // Fiches du groupe actif restreintes à celles dont le demandeur est propriétaire.
    const groupSheets = await this.characterSheetRepository.findByGroupId(query.groupId);
    const sheets = groupSheets.filter((sheet) => sheet.isOwnedBy(query.userId));

    const summaries: CharacterSheetSummary[] = sheets.map((sheet) => ({
      id: sheet.id,
      ownerId: sheet.ownerId,
      name: sheet.name.value,
      createdAt: sheet.createdAt,
    }));

    return Result.success(summaries);
  }
}
