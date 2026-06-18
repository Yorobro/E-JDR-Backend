import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceName } from "@domain/features/reference/value-objects/ReferenceName";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { ReferenceItemNotFoundError } from "@application/features/reference/errors/ReferenceItemNotFoundError";
import { ReferenceNameAlreadyUsedError } from "@application/features/reference/errors/ReferenceNameAlreadyUsedError";
import {
  CreateReferenceItemCommand,
  CreateReferenceItemUseCase,
  DeleteReferenceItemCommand,
  DeleteReferenceItemUseCase,
  ListReferenceItemsQuery,
  ListReferenceItemsUseCase,
} from "@application/features/reference/abstractions/usecases/ReferenceCatalogueUseCases";
import { ReferenceItemView } from "@application/features/reference/abstractions/usecases/ReferenceItemView";

/** Sélectionne dans `TransactionalRepositories` le repository de la catégorie gérée. */
type RepoSelector = (
  repos: import("@application/shared/UnitOfWork").TransactionalRepositories,
) => ReferenceRepository;

/** Projette une entité vers sa vue publique. */
function toView(item: ReferenceItem): ReferenceItemView {
  return { id: item.id, name: item.name.value, createdAt: item.createdAt };
}

/**
 * Use case **générique** de création d'un élément de référence.
 *
 * Une instance par catégorie : le `repository` (lecture, pour l'anti-doublon) et le `selectRepo`
 * (écriture transactionnelle) pointent tous deux vers la même table. Valide le nom (VO), refuse
 * un doublon de nom pour ce propriétaire (`existsByOwnerAndName`), puis persiste via le UnitOfWork.
 */
export class CreateReferenceItemUseCaseImpl implements CreateReferenceItemUseCase {
  constructor(
    private readonly repository: ReferenceRepository,
    private readonly selectRepo: RepoSelector,
    private readonly idGenerator: IdGeneratorService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(
    command: CreateReferenceItemCommand,
  ): Promise<Result<ReferenceItemView, AppError>> {
    let name: ReferenceName;
    try {
      name = ReferenceName.create(command.name);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    if (await this.repository.existsByOwnerAndName(command.ownerId, name.value)) {
      return Result.failure(new ReferenceNameAlreadyUsedError());
    }

    const item = ReferenceItem.create({
      id: this.idGenerator.generate(),
      ownerId: command.ownerId,
      name,
      createdAt: new Date(),
    });

    await this.unitOfWork.execute(async (repos) => {
      await this.selectRepo(repos).save(item);
    });

    this.logger.info("Élément de référence créé", { itemId: item.id, ownerId: item.ownerId });

    return Result.success(toView(item));
  }
}

/** Use case **générique** « lister mes éléments de référence ». Lecture pure. */
export class ListReferenceItemsUseCaseImpl implements ListReferenceItemsUseCase {
  constructor(private readonly repository: ReferenceRepository) {}

  public async execute(
    query: ListReferenceItemsQuery,
  ): Promise<Result<ReferenceItemView[], AppError>> {
    const items = await this.repository.findByOwnerId(query.ownerId);
    return Result.success(items.map(toView));
  }
}

/**
 * Use case **générique** de suppression d'un élément de référence. Charge l'élément, vérifie la
 * propriété (`isOwnedBy`), puis supprime via le UnitOfWork. La suppression d'un élément référencé
 * met automatiquement à `null` les fiches (FK `ON DELETE set null`) ou retire les liaisons N‑N
 * (FK `cascade`) — géré par la base.
 */
export class DeleteReferenceItemUseCaseImpl implements DeleteReferenceItemUseCase {
  constructor(
    private readonly repository: ReferenceRepository,
    private readonly selectRepo: RepoSelector,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(command: DeleteReferenceItemCommand): Promise<Result<void, AppError>> {
    const item = await this.repository.findById(command.itemId);
    // Inexistant OU non possédé : même réponse 404 (ne pas révéler l'existence d'un élément d'autrui).
    if (item === null || !item.isOwnedBy(command.ownerId)) {
      return Result.failure(new ReferenceItemNotFoundError());
    }

    await this.unitOfWork.execute(async (repos) => {
      await this.selectRepo(repos).deleteById(item.id);
    });

    this.logger.info("Élément de référence supprimé", {
      itemId: item.id,
      ownerId: command.ownerId,
    });

    return Result.success(undefined);
  }
}
