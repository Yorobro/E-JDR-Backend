import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { GetCharacterSheetQuery } from "@application/features/character-sheet/query/GetCharacterSheetQuery";
import { GetCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/GetCharacterSheetUseCase";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { toCharacterSheetDetail } from "@application/features/character-sheet/usecases/toCharacterSheetDetail";

/**
 * Use case de consultation détaillée d'une fiche.
 *
 * Charge la fiche, vérifie que le demandeur est **membre du groupe** de la fiche (visibilité
 * « tout le groupe », D10), puis projette la fiche complète. Lecture pure (sans `UnitOfWork`).
 */
export class GetCharacterSheetUseCaseImpl implements GetCharacterSheetUseCase {
  constructor(
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly groupAccessService: GroupAccessService,
    private readonly logger: Logger,
  ) {}

  public async execute(
    query: GetCharacterSheetQuery,
  ): Promise<Result<CharacterSheetDetail, AppError>> {
    const sheet = await this.characterSheetRepository.findById(query.characterSheetId);

    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    const memberAccess = await this.groupAccessService.requireMember(query.userId, sheet.groupId);
    if (memberAccess.isFailure) {
      this.logger.warn("Tentative de consultation d'une fiche par un non-membre du groupe", {
        characterSheetId: query.characterSheetId,
        userId: query.userId,
      });
      return Result.failure(memberAccess.error);
    }

    return Result.success(toCharacterSheetDetail(sheet));
  }
}
