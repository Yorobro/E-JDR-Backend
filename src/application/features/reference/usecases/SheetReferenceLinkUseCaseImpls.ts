import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { TransactionalRepositories, UnitOfWork } from "@application/shared/UnitOfWork";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { SheetReferenceLinkRepository } from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";
import { ReferenceItemNotFoundError } from "@application/features/reference/errors/ReferenceItemNotFoundError";
import {
  LinkSheetReferenceCommand,
  LinkSheetReferenceUseCase,
  ListSheetReferencesQuery,
  ListSheetReferencesUseCase,
  UnlinkSheetReferenceCommand,
  UnlinkSheetReferenceUseCase,
} from "@application/features/reference/abstractions/usecases/SheetReferenceLinkUseCases";
import { ReferenceItemView } from "@application/features/reference/abstractions/usecases/ReferenceItemView";

/** Sélectionne le repository de liaison de la catégorie gérée dans une transaction. */
type LinkRepoSelector = (repos: TransactionalRepositories) => SheetReferenceLinkRepository;

function toView(item: ReferenceItem): ReferenceItemView {
  const statBonus = item.statBonus;
  return {
    id: item.id,
    name: item.name.value,
    createdAt: item.createdAt,
    stat: statBonus?.stat ?? null,
    bonus: statBonus?.amount ?? null,
    // Types liables à une fiche (armes/armures/compétences/équipements) : pas de compétences liées.
    competenceIds: [],
  };
}

/**
 * Use case **générique** de rattachement d'un élément de référence à une fiche (N‑N).
 *
 * Une instance par catégorie liable (arme/armure/compétence/équipement). Vérifie que la fiche
 * existe et appartient au demandeur, que l'élément existe et lui appartient aussi (on ne lie que
 * son propre catalogue), puis crée la liaison (idempotente : ré-attacher ne fait rien de plus).
 */
/** Dépendances du use case de rattachement (regroupées pour rester sous la limite de paramètres). */
export interface LinkSheetReferenceDeps {
  readonly characterSheetRepository: CharacterSheetRepository;
  readonly itemRepository: ReferenceRepository;
  readonly linkRepository: SheetReferenceLinkRepository;
  readonly selectLinkRepo: LinkRepoSelector;
  readonly groupAccessService: GroupAccessService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
}

export class LinkSheetReferenceUseCaseImpl implements LinkSheetReferenceUseCase {
  private readonly characterSheetRepository: CharacterSheetRepository;
  private readonly itemRepository: ReferenceRepository;
  private readonly linkRepository: SheetReferenceLinkRepository;
  private readonly selectLinkRepo: LinkRepoSelector;
  private readonly groupAccessService: GroupAccessService;
  private readonly unitOfWork: UnitOfWork;
  private readonly logger: Logger;

  constructor(deps: LinkSheetReferenceDeps) {
    this.characterSheetRepository = deps.characterSheetRepository;
    this.itemRepository = deps.itemRepository;
    this.linkRepository = deps.linkRepository;
    this.selectLinkRepo = deps.selectLinkRepo;
    this.groupAccessService = deps.groupAccessService;
    this.unitOfWork = deps.unitOfWork;
    this.logger = deps.logger;
  }

  public async execute(command: LinkSheetReferenceCommand): Promise<Result<void, AppError>> {
    const sheet = await this.characterSheetRepository.findById(command.sheetId);
    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }
    if (!sheet.isOwnedBy(command.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const item = await this.itemRepository.findById(command.itemId);
    if (item === null) {
      return Result.failure(new ReferenceItemNotFoundError());
    }
    const itemAccess = await this.groupAccessService.requireMember(
      command.actorUserId,
      item.groupId,
    );
    if (itemAccess.isFailure) {
      return Result.failure(new ReferenceItemNotFoundError());
    }

    // Anti-doublon : la PK composite l'empêche aussi côté BDD ; on évite juste une erreur SQL.
    if (await this.linkRepository.existsBySheetAndItem(sheet.id, item.id)) {
      return Result.success(undefined);
    }

    await this.unitOfWork.execute(async (repos) => {
      await this.selectLinkRepo(repos).link(sheet.id, item.id, new Date());
    });

    this.logger.info("Élément de référence rattaché à une fiche", {
      sheetId: sheet.id,
      itemId: item.id,
    });

    return Result.success(undefined);
  }
}

/**
 * Use case **générique** de détachement d'un élément de référence d'une fiche (N‑N). Vérifie la
 * propriété de la fiche puis retire la liaison (idempotent).
 */
export class UnlinkSheetReferenceUseCaseImpl implements UnlinkSheetReferenceUseCase {
  constructor(
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly selectLinkRepo: LinkRepoSelector,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(command: UnlinkSheetReferenceCommand): Promise<Result<void, AppError>> {
    const sheet = await this.characterSheetRepository.findById(command.sheetId);
    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }
    if (!sheet.isOwnedBy(command.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    await this.unitOfWork.execute(async (repos) => {
      await this.selectLinkRepo(repos).unlink(command.sheetId, command.itemId);
    });

    this.logger.info("Élément de référence détaché d'une fiche", {
      sheetId: command.sheetId,
      itemId: command.itemId,
    });

    return Result.success(undefined);
  }
}

/**
 * Use case **générique** « lister les éléments rattachés à une fiche ». Vérifie la propriété de la
 * fiche puis lit la liaison (lecture pure, hors UnitOfWork).
 */
export class ListSheetReferencesUseCaseImpl implements ListSheetReferencesUseCase {
  constructor(
    private readonly characterSheetRepository: CharacterSheetRepository,
    private readonly linkRepository: SheetReferenceLinkRepository,
  ) {}

  public async execute(
    query: ListSheetReferencesQuery,
  ): Promise<Result<ReferenceItemView[], AppError>> {
    const sheet = await this.characterSheetRepository.findById(query.sheetId);
    if (sheet === null) {
      return Result.failure(new CharacterSheetNotFoundError());
    }
    if (!sheet.isOwnedBy(query.actorUserId)) {
      return Result.failure(new CharacterSheetAccessDeniedError());
    }

    const items = await this.linkRepository.findItemsBySheet(sheet.id);
    return Result.success(items.map(toView));
  }
}
