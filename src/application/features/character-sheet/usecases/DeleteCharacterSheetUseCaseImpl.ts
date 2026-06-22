import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { DeleteCharacterSheetCommand } from "@application/features/character-sheet/commands/DeleteCharacterSheetCommand";
import { DeleteCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/DeleteCharacterSheetUseCase";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";

/**
 * Use case de suppression d'une fiche.
 *
 * Charge la fiche, vérifie que le demandeur en est le **propriétaire** ou un **éditeur
 * (ADMIN/MJ) du groupe** de la fiche (`sheet.groupId`), puis la supprime. La suppression
 * de la fiche retire aussi ses liens de campagne (ON DELETE CASCADE sur `campaign_characters`).
 */
export class DeleteCharacterSheetUseCaseImpl implements DeleteCharacterSheetUseCase {
  constructor(
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
    private readonly groupAccessService: GroupAccessService,
    private readonly realtimeNotifier: RealtimeNotifier,
  ) {}

  public async execute(command: DeleteCharacterSheetCommand): Promise<Result<void, AppError>> {
    const sheet = await this.characterSheetRepository.findById(command.characterSheetId);

    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    const canDelete =
      sheet.isOwnedBy(command.ownerId) ||
      (await this.groupAccessService.requireEditor(command.ownerId, sheet.groupId)).isSuccess;
    if (!canDelete) {
      this.logger.warn("Tentative de suppression d'une fiche sans droit (ni proprio ni éditeur)", {
        characterSheetId: command.characterSheetId,
        ownerId: command.ownerId,
      });
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    await this.unitOfWork.execute(async (repos) => {
      await repos.characterSheets.deleteById(sheet.id);
    });

    this.logger.info("Fiche de personnage supprimée", {
      characterSheetId: sheet.id,
      ownerId: sheet.ownerId,
    });

    // Rafraîchit la liste « Mes fiches » du PROPRIÉTAIRE (pas du demandeur : un éditeur du
    // groupe peut supprimer la fiche d'autrui). Best-effort : n'impacte pas la suppression.
    this.realtimeNotifier.notifyUserChanged(sheet.ownerId, "character-sheets");

    return Result.success(undefined);
  }
}
