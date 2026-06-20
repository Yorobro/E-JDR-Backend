import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import { Sex } from "@domain/features/character-sheet/value-objects/Sex";
import { Purse } from "@domain/features/character-sheet/value-objects/Purse";
import { CharacterSheetDetails } from "@domain/features/character-sheet/entities/CharacterSheet";
import { DomainError } from "@domain/shared/errors/DomainError";
import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { UpdateCharacterSheetCommand } from "@application/features/character-sheet/commands/UpdateCharacterSheetCommand";
import { UpdateCharacterSheetUseCase } from "@application/features/character-sheet/abstractions/usecases/UpdateCharacterSheetUseCase";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { toCharacterSheetDetail } from "@application/features/character-sheet/usecases/toCharacterSheetDetail";
import { FormationRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { PeupleRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { ReferenceItemNotFoundError } from "@application/features/reference/errors/ReferenceItemNotFoundError";

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
    private readonly formationRepository: FormationRepository,
    private readonly peupleRepository: PeupleRepository,
    private readonly groupAccessService: GroupAccessService,
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

    // Modifier = propriétaire OU éditeur (ADMIN/MJ) du groupe de la fiche.
    const canEdit =
      sheet.isOwnedBy(command.ownerId) ||
      (await this.groupAccessService.requireEditor(command.ownerId, sheet.groupId)).isSuccess;
    if (!canEdit) {
      this.logger.warn("Tentative de modification d'une fiche sans droit (ni proprio ni éditeur)", {
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

    let sexe: Sex | null = null;
    let purse: Purse | null = null;
    try {
      if (command.sexe != null && command.sexe !== "") {
        sexe = Sex.create(command.sexe);
      }
      if (command.purse != null) {
        purse = Purse.create({
          gold: command.purse.gold ?? 0,
          silver: command.purse.silver ?? 0,
          copper: command.purse.copper ?? 0,
        });
      }
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    // Les références N-1 (formation/peuple), si fournies, doivent exister dans un groupe
    // dont l'acteur est membre.
    const formationId = normalizeId(command.formationId);
    const peupleId = normalizeId(command.peupleId);
    if (
      formationId !== null &&
      !(await this.canUseItem(this.formationRepository, formationId, command.ownerId))
    ) {
      return Result.failure(new ReferenceItemNotFoundError());
    }
    if (
      peupleId !== null &&
      !(await this.canUseItem(this.peupleRepository, peupleId, command.ownerId))
    ) {
      return Result.failure(new ReferenceItemNotFoundError());
    }

    const updated = sheet.withDetails({
      name,
      sexe,
      purse,
      formationId,
      peupleId,
      ...this.detailsFrom(command),
    });

    await this.unitOfWork.execute(async (repos) => {
      await repos.characterSheets.update(updated);
    });

    this.logger.info("Fiche de personnage mise à jour", {
      characterSheetId: updated.id,
      ownerId: updated.ownerId,
    });

    return Result.success(toCharacterSheetDetail(updated));
  }

  /**
   * Normalise les champs détaillés de la commande vers le format domaine, **hors** `sexe`,
   * `purse` et les références `formationId`/`peupleId` (traités à part dans {@link execute}).
   *
   * `pointsDeVie` et `protection` sont **volontairement absents** : ce sont des valeurs **dérivées**
   * (recalculées à la lecture depuis vigueur + bonus formation/peuple + armures liées) et ne doivent
   * donc jamais être persistées depuis l'input client. Les omettre du `Partial` préserve simplement
   * les colonnes existantes (`withDetails` fusionne), et la lecture les écrasera de toute façon.
   */
  private detailsFrom(command: UpdateCharacterSheetCommand): Partial<CharacterSheetDetails> {
    return {
      niveau: nonNegativeInt(command.niveau),
      tailleEtPoids: shortText(command.tailleEtPoids),
      age: nonNegativeInt(command.age),
      apparence: longText(command.apparence),
      dexterite: nonNegativeInt(command.dexterite),
      intelligence: nonNegativeInt(command.intelligence),
      perception: nonNegativeInt(command.perception),
      social: nonNegativeInt(command.social),
      vigueur: nonNegativeInt(command.vigueur),
      pointsDeMagie: nonNegativeInt(command.pointsDeMagie),
      notes: longText(command.notes),
    };
  }

  /**
   * Vérifie qu'un élément de référence existe et que l'acteur est membre de son groupe.
   */
  private async canUseItem(
    repository: { findById(id: string): Promise<{ groupId: string } | null> },
    itemId: string,
    actorId: string,
  ): Promise<boolean> {
    const item = await repository.findById(itemId);
    if (item === null) return false;
    const access = await this.groupAccessService.requireMember(actorId, item.groupId);
    return access.isSuccess;
  }
}

/** Normalise un id de référence optionnel : trim, `null` si absent ou vide. */
function normalizeId(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}
