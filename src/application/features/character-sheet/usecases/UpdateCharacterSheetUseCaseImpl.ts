import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import { CharacterSheetDetails } from "@domain/features/character-sheet/entities/CharacterSheet";
import { DomainError } from "@domain/shared/errors/DomainError";
import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { UpdateCharacterSheetCommand } from "@application/features/character-sheet/commands/UpdateCharacterSheetCommand";
import {
  UpdateCharacterSheetUseCase,
} from "@application/features/character-sheet/abstractions/usecases/UpdateCharacterSheetUseCase";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { toCharacterSheetDetail } from "@application/features/character-sheet/usecases/toCharacterSheetDetail";

/** Longueur maximale des champs de texte court (alignée sur `VARCHAR(255)`). */
const SHORT_TEXT_MAX_LENGTH = 255;

/** Normalise un texte court : trim, `null` si vide, tronqué à la longueur de colonne. */
function shortText(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, SHORT_TEXT_MAX_LENGTH);
}

/** Normalise un texte long : `null` si vide après trim, sinon la valeur (colonne `TEXT`). */
function longText(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Normalise un entier optionnel : `null` si absent, sinon l'entier (les négatifs deviennent 0). */
function nonNegativeInt(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined || Number.isNaN(raw)) {
    return null;
  }
  const integer = Math.trunc(raw);
  return integer < 0 ? 0 : integer;
}

/**
 * Use case de mise à jour d'une fiche.
 *
 * Charge la fiche, vérifie via le domaine que le demandeur en est le **propriétaire**, revalide
 * le nom (value object), normalise les champs détaillés (trim, bornage, entiers ≥ 0), reconstruit
 * l'entité immuable via `withDetails`, puis persiste. Aucune règle métier sur les valeurs.
 */
export class UpdateCharacterSheetUseCaseImpl implements UpdateCharacterSheetUseCase {
  constructor(
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(
    command: UpdateCharacterSheetCommand,
  ): Promise<Result<CharacterSheetDetail, AppError>> {
    const sheet = await this.characterSheetRepository.findById(command.characterSheetId);

    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }

    if (!sheet.isOwnedBy(command.ownerId)) {
      this.logger.warn("Tentative de modification d'une fiche par un non-propriétaire", {
        characterSheetId: command.characterSheetId,
        ownerId: command.ownerId,
      });
      return Result.failure(new CharacterSheetAccessDeniedError());
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

    const updated = sheet.withDetails({ name, ...this.detailsFrom(command) });

    await this.unitOfWork.execute(async (repos) => {
      await repos.characterSheets.update(updated);
    });

    this.logger.info("Fiche de personnage mise à jour", {
      characterSheetId: updated.id,
      ownerId: updated.ownerId,
    });

    return Result.success(toCharacterSheetDetail(updated));
  }

  /** Normalise les champs détaillés de la commande vers le format domaine. */
  private detailsFrom(command: UpdateCharacterSheetCommand): CharacterSheetDetails {
    return {
      formation: shortText(command.formation),
      niveau: shortText(command.niveau),
      peuple: shortText(command.peuple),
      sexe: shortText(command.sexe),
      tailleEtPoids: shortText(command.tailleEtPoids),
      age: shortText(command.age),
      apparence: shortText(command.apparence),
      dexterite: nonNegativeInt(command.dexterite),
      intelligence: nonNegativeInt(command.intelligence),
      perception: nonNegativeInt(command.perception),
      social: nonNegativeInt(command.social),
      vigueur: nonNegativeInt(command.vigueur),
      pointsDeVie: nonNegativeInt(command.pointsDeVie),
      pointsDeMagie: nonNegativeInt(command.pointsDeMagie),
      protection: nonNegativeInt(command.protection),
      monnaie: nonNegativeInt(command.monnaie),
      armes: longText(command.armes),
      armures: longText(command.armures),
      equipement: longText(command.equipement),
      sortsEtMiracles: longText(command.sortsEtMiracles),
      notes: longText(command.notes),
    };
  }
}
