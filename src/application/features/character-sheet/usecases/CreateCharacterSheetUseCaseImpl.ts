import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CreateCharacterSheetCommand } from "@application/features/character-sheet/commands/CreateCharacterSheetCommand";
import {
  CreateCharacterSheetUseCase,
  CreateCharacterSheetResult,
} from "@application/features/character-sheet/abstractions/usecases/CreateCharacterSheetUseCase";

/**
 * Use case de création d'une fiche de personnage.
 *
 * Orchestration pure : vérifie que l'utilisateur est membre du groupe, valide le nom via le
 * domaine, crée l'entité (propriétaire = utilisateur courant, groupe = groupe actif), puis la
 * persiste via le `UnitOfWork`.
 */
export class CreateCharacterSheetUseCaseImpl implements CreateCharacterSheetUseCase {
  constructor(
    private readonly idGenerator: IdGeneratorService,
    private readonly groupAccessService: GroupAccessService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
    private readonly realtimeNotifier: RealtimeNotifier,
  ) {}

  public async execute(
    command: CreateCharacterSheetCommand,
  ): Promise<Result<CreateCharacterSheetResult, AppError>> {
    const memberAccess = await this.groupAccessService.requireMember(
      command.ownerId,
      command.groupId,
    );
    if (memberAccess.isFailure) {
      return Result.failure(memberAccess.error);
    }

    let name: CharacterSheetName;

    try {
      name = CharacterSheetName.create(command.name);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    const sheet = CharacterSheet.create({
      id: this.idGenerator.generate(),
      ownerId: command.ownerId,
      groupId: command.groupId,
      name,
      createdAt: new Date(),
    });

    await this.unitOfWork.execute(async (repos) => {
      await repos.characterSheets.save(sheet);
    });

    this.logger.info("Fiche de personnage créée", {
      characterSheetId: sheet.id,
      ownerId: sheet.ownerId,
    });

    // Notifie en temps réel les autres appareils du propriétaire pour qu'ils rafraîchissent
    // leur liste « Mes fiches » (best-effort : n'impacte pas le résultat de la création).
    this.realtimeNotifier.notifyUserChanged(sheet.ownerId, "character-sheets");

    return Result.success({
      id: sheet.id,
      ownerId: sheet.ownerId,
      name: sheet.name.value,
      createdAt: sheet.createdAt,
    });
  }
}
