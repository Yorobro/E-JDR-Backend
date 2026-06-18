import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceName } from "@domain/features/reference/value-objects/ReferenceName";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
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
 * Seuls les admins du groupe peuvent créer des entrées de catalogue.
 */
export class CreateReferenceItemUseCaseImpl implements CreateReferenceItemUseCase {
  constructor(
    private readonly repository: ReferenceRepository,
    private readonly selectRepo: RepoSelector,
    private readonly idGenerator: IdGeneratorService,
    private readonly groupAccessService: GroupAccessService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(
    command: CreateReferenceItemCommand,
  ): Promise<Result<ReferenceItemView, AppError>> {
    const accessResult = await this.groupAccessService.requireAdmin(
      command.actorId,
      command.groupId,
    );
    if (accessResult.isFailure) return Result.failure(accessResult.error);

    let name: ReferenceName;
    try {
      name = ReferenceName.create(command.name);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    if (await this.repository.existsByGroupAndName(command.groupId, name.value)) {
      return Result.failure(new ReferenceNameAlreadyUsedError());
    }

    const item = ReferenceItem.create({
      id: this.idGenerator.generate(),
      groupId: command.groupId,
      name,
      createdAt: new Date(),
    });

    await this.unitOfWork.execute(async (repos) => {
      await this.selectRepo(repos).save(item);
    });

    this.logger.info("Élément de référence créé", { itemId: item.id, groupId: item.groupId });

    return Result.success(toView(item));
  }
}

/** Use case **générique** « lister les éléments de référence d'un groupe ». Lecture pure. */
export class ListReferenceItemsUseCaseImpl implements ListReferenceItemsUseCase {
  constructor(
    private readonly repository: ReferenceRepository,
    private readonly groupAccessService: GroupAccessService,
  ) {}

  public async execute(
    query: ListReferenceItemsQuery,
  ): Promise<Result<ReferenceItemView[], AppError>> {
    const accessResult = await this.groupAccessService.requireMember(query.actorId, query.groupId);
    if (accessResult.isFailure) return Result.failure(accessResult.error);

    const items = await this.repository.findByGroupId(query.groupId);
    return Result.success(items.map(toView));
  }
}

/**
 * Use case **générique** de suppression d'un élément de référence.
 *
 * Seuls les admins du groupe peuvent supprimer des entrées de catalogue.
 */
export class DeleteReferenceItemUseCaseImpl implements DeleteReferenceItemUseCase {
  constructor(
    private readonly repository: ReferenceRepository,
    private readonly selectRepo: RepoSelector,
    private readonly groupAccessService: GroupAccessService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(command: DeleteReferenceItemCommand): Promise<Result<void, AppError>> {
    const item = await this.repository.findById(command.itemId);
    if (item === null) {
      return Result.failure(new ReferenceItemNotFoundError());
    }

    const accessResult = await this.groupAccessService.requireAdmin(command.actorId, item.groupId);
    if (accessResult.isFailure) return Result.failure(new ReferenceItemNotFoundError());

    await this.unitOfWork.execute(async (repos) => {
      await this.selectRepo(repos).deleteById(item.id);
    });

    this.logger.info("Élément de référence supprimé", {
      itemId: item.id,
      groupId: item.groupId,
    });

    return Result.success(undefined);
  }
}
