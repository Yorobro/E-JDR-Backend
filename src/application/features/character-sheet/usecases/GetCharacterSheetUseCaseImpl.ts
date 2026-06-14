import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { GetCharacterSheetQuery } from "@application/features/character-sheet/query/GetCharacterSheetQuery";
import {
  GetCharacterSheetUseCase,
} from "@application/features/character-sheet/abstractions/usecases/GetCharacterSheetUseCase";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { toCharacterSheetDetail } from "@application/features/character-sheet/usecases/toCharacterSheetDetail";

/**
 * Use case de consultation détaillée d'une fiche.
 *
 * Charge la fiche, vérifie via le domaine que le demandeur en est le **propriétaire**
 * (`sheet.isOwnedBy`), puis projette la fiche complète. Lecture pure (sans `UnitOfWork`).
 */
export class GetCharacterSheetUseCaseImpl implements GetCharacterSheetUseCase {
  constructor(
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly logger: Logger,
  ) {}

  public async execute(
    query: GetCharacterSheetQuery,
  ): Promise<Result<CharacterSheetDetail, AppError>> {
    const sheet = await this.characterSheetRepository.findById(query.characterSheetId);

    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    if (!sheet.isOwnedBy(query.ownerId)) {
      this.logger.warn("Tentative de consultation d'une fiche par un non-propriétaire", {
        characterSheetId: query.characterSheetId,
        ownerId: query.ownerId,
      });
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    return Result.success(toCharacterSheetDetail(sheet));
  }
}
