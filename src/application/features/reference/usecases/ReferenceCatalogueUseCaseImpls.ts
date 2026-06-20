import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceName } from "@domain/features/reference/value-objects/ReferenceName";
import { StatBonus } from "@domain/features/reference/value-objects/StatBonus";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { UnitOfWork } from "@application/shared/UnitOfWork";
import { tryCreateValueObject } from "@application/shared/tryCreateValueObject";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";
import { ReferenceItemNotFoundError } from "@application/features/reference/errors/ReferenceItemNotFoundError";
import { ReferenceNameAlreadyUsedError } from "@application/features/reference/errors/ReferenceNameAlreadyUsedError";
import {
  CreateReferenceItemCommand,
  CreateReferenceItemUseCase,
  DeleteReferenceItemCommand,
  DeleteReferenceItemUseCase,
  ListReferenceItemsQuery,
  ListReferenceItemsUseCase,
  UpdateReferenceItemCommand,
  UpdateReferenceItemUseCase,
} from "@application/features/reference/abstractions/usecases/ReferenceCatalogueUseCases";
import { ReferenceItemView } from "@application/features/reference/abstractions/usecases/ReferenceItemView";

/** Sélectionne dans `TransactionalRepositories` le repository de la catégorie gérée. */
type RepoSelector = (
  repos: import("@application/shared/UnitOfWork").TransactionalRepositories,
) => ReferenceRepository;

/**
 * Dépendances **spécifiques aux formations** pour la création : le catalogue de compétences (pour
 * vérifier que chaque compétence référencée appartient au même groupe) et la liaison N‑N
 * formation ↔ compétences (pour poser les liens). Absentes pour les autres types.
 */
export interface FormationCreateDeps {
  /** Catalogue de compétences du groupe (lecture : vérification de portée). */
  readonly competences: ReferenceRepository;
  /** Liaison transactionnelle formation ↔ compétences (sélection dans l'UoW). */
  readonly formationCompetences: (
    repos: import("@application/shared/UnitOfWork").TransactionalRepositories,
  ) => FormationCompetenceLinkRepository;
}

/**
 * Dépendances **spécifiques aux formations** pour la lecture : la liaison formation ↔ compétences
 * (lecture pure) afin de renseigner `competenceIds` dans la vue. Absente pour les autres types.
 */
export interface FormationListDeps {
  /** Liaison formation ↔ compétences (lecture pure). */
  readonly formationCompetences: FormationCompetenceLinkRepository;
}

/**
 * Construit le bonus de statistique à partir d'une stat/bonus bruts, ou `null` si aucune stat
 * fournie. Partagé par la création et la modification.
 *
 * @param stat - La statistique ciblée (`undefined`/`null` ⇒ aucun bonus).
 * @param bonus - Le montant du bonus (défaut 1 si `stat` fournie sans montant).
 * @returns Le `StatBonus` validé, ou `null` (pas de bonus).
 * @throws {DomainError} Si la stat ou le montant sont invalides (capté par l'appelant).
 */
function buildStatBonus(
  stat: string | null | undefined,
  bonus: number | null | undefined,
): StatBonus | null {
  if (stat === undefined || stat === null) {
    return null;
  }
  return StatBonus.create({ stat, amount: bonus });
}

/** Projette une entité vers sa vue publique (sans compétences ⇒ tableau vide par défaut). */
function toView(item: ReferenceItem, competenceIds: string[] = []): ReferenceItemView {
  const statBonus = item.statBonus;
  return {
    id: item.id,
    name: item.name.value,
    createdAt: item.createdAt,
    stat: statBonus?.stat ?? null,
    bonus: statBonus?.amount ?? null,
    protectionPoints: item.protectionPoints,
    description: item.description,
    competenceIds,
  };
}

/**
 * Dépendances du use case de création d'un élément de référence (regroupées dans un objet pour
 * rester sous la limite de paramètres de constructeur).
 */
export interface CreateReferenceItemDeps {
  /** Catalogue du type géré (lecture : unicité du nom). */
  readonly repository: ReferenceRepository;
  /** Sélectionne, dans la transaction, le catalogue du type géré (écriture). */
  readonly selectRepo: RepoSelector;
  /** Génère l'identifiant du nouvel élément. */
  readonly idGenerator: IdGeneratorService;
  /** Vérifie que l'acteur est admin du groupe. */
  readonly groupAccessService: GroupAccessService;
  /** Encapsule l'écriture (élément + liens) dans une transaction. */
  readonly unitOfWork: UnitOfWork;
  /** Journalisation applicative. */
  readonly logger: Logger;
  /**
   * Dépendances spécifiques aux formations (compétences). Absentes pour les autres types : un
   * `competenceIds` fourni serait alors ignoré.
   */
  readonly formationDeps?: FormationCreateDeps;
}

/**
 * Use case **générique** de création d'un élément de référence.
 *
 * Seuls les admins du groupe peuvent créer des entrées de catalogue. Pour les formations, le bonus
 * de statistique (`stat`/`bonus`) et les compétences liées sont gérés ; les autres types ignorent
 * ces champs.
 */
export class CreateReferenceItemUseCaseImpl implements CreateReferenceItemUseCase {
  private readonly repository: ReferenceRepository;
  private readonly selectRepo: RepoSelector;
  private readonly idGenerator: IdGeneratorService;
  private readonly groupAccessService: GroupAccessService;
  private readonly unitOfWork: UnitOfWork;
  private readonly logger: Logger;
  private readonly formationDeps?: FormationCreateDeps;

  constructor(deps: CreateReferenceItemDeps) {
    this.repository = deps.repository;
    this.selectRepo = deps.selectRepo;
    this.idGenerator = deps.idGenerator;
    this.groupAccessService = deps.groupAccessService;
    this.unitOfWork = deps.unitOfWork;
    this.logger = deps.logger;
    this.formationDeps = deps.formationDeps;
  }

  public async execute(
    command: CreateReferenceItemCommand,
  ): Promise<Result<ReferenceItemView, AppError>> {
    const accessResult = await this.groupAccessService.requireAdmin(
      command.actorId,
      command.groupId,
    );
    if (accessResult.isFailure) return Result.failure(accessResult.error);

    let name: ReferenceName;
    let statBonus: StatBonus | null;
    try {
      name = ReferenceName.create(command.name);
      statBonus = buildStatBonus(command.stat, command.bonus);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    if (await this.repository.existsByGroupAndName(command.groupId, name.value)) {
      return Result.failure(new ReferenceNameAlreadyUsedError());
    }

    // Compétences à rattacher : pertinent uniquement pour les formations (deps présentes).
    const formationDeps = this.formationDeps;
    const competenceIds = formationDeps !== undefined ? (command.competenceIds ?? []) : [];

    // Chaque compétence doit exister dans le **même groupe** (portée + intégrité du lien).
    if (formationDeps !== undefined) {
      for (const competenceId of competenceIds) {
        const exists = await formationDeps.competences.existsInGroup(command.groupId, competenceId);
        if (!exists) {
          return Result.failure(new ReferenceItemNotFoundError());
        }
      }
    }

    const itemResult = tryCreateValueObject(() =>
      ReferenceItem.create({
        id: this.idGenerator.generate(),
        groupId: command.groupId,
        name,
        createdAt: new Date(),
        statBonus,
        // Pertinent uniquement pour les armures ; ignoré (resté null) pour les autres types.
        protectionPoints: command.protectionPoints ?? null,
        // Pertinent uniquement pour sorts/miracles ; ignorée (restée null) pour les autres types.
        description: command.description ?? null,
      }),
    );
    if (itemResult.isFailure) return Result.failure(itemResult.error);
    const item = itemResult.value;

    await this.unitOfWork.execute(async (repos) => {
      await this.selectRepo(repos).save(item);
      if (formationDeps !== undefined && competenceIds.length > 0) {
        const links = formationDeps.formationCompetences(repos);
        for (const competenceId of competenceIds) {
          await links.link(item.id, competenceId, item.createdAt);
        }
      }
    });

    this.logger.info("Élément de référence créé", { itemId: item.id, groupId: item.groupId });

    return Result.success(toView(item, competenceIds));
  }
}

/**
 * Dépendances du use case de modification d'un élément de référence (regroupées dans un objet pour
 * rester sous la limite de paramètres de constructeur). Symétrique de {@link CreateReferenceItemDeps}.
 */
export interface UpdateReferenceItemDeps {
  /** Catalogue du type géré (lecture : recherche de l'élément + unicité du nom). */
  readonly repository: ReferenceRepository;
  /** Sélectionne, dans la transaction, le catalogue du type géré (écriture). */
  readonly selectRepo: RepoSelector;
  /** Vérifie que l'acteur est admin du groupe. */
  readonly groupAccessService: GroupAccessService;
  /** Encapsule l'écriture (élément + liens) dans une transaction. */
  readonly unitOfWork: UnitOfWork;
  /** Journalisation applicative. */
  readonly logger: Logger;
  /**
   * Dépendances spécifiques aux formations (compétences). Absentes pour les autres types : un
   * `competenceIds` fourni serait alors ignoré.
   */
  readonly formationDeps?: FormationCreateDeps;
}

/**
 * Use case **générique** de modification d'un élément de référence (**remplacement complet**).
 *
 * Seuls les admins du groupe peuvent modifier des entrées de catalogue. Le client envoie l'état
 * complet souhaité ; le back le remplace intégralement. Pour une formation, les compétences liées
 * sont entièrement remplacées (suppression de tous les liens existants puis réinsertion de la
 * nouvelle liste), le tout **dans la transaction**. Le type ne change pas.
 */
export class UpdateReferenceItemUseCaseImpl implements UpdateReferenceItemUseCase {
  private readonly repository: ReferenceRepository;
  private readonly selectRepo: RepoSelector;
  private readonly groupAccessService: GroupAccessService;
  private readonly unitOfWork: UnitOfWork;
  private readonly logger: Logger;
  private readonly formationDeps?: FormationCreateDeps;

  constructor(deps: UpdateReferenceItemDeps) {
    this.repository = deps.repository;
    this.selectRepo = deps.selectRepo;
    this.groupAccessService = deps.groupAccessService;
    this.unitOfWork = deps.unitOfWork;
    this.logger = deps.logger;
    this.formationDeps = deps.formationDeps;
  }

  public async execute(
    command: UpdateReferenceItemCommand,
  ): Promise<Result<ReferenceItemView, AppError>> {
    const accessResult = await this.groupAccessService.requireAdmin(
      command.actorId,
      command.groupId,
    );
    if (accessResult.isFailure) return Result.failure(accessResult.error);

    const existing = await this.repository.findById(command.itemId);
    // L'élément doit exister **et** appartenir au groupe ciblé (sinon : introuvable, sans révéler).
    if (existing === null || !existing.isInGroup(command.groupId)) {
      return Result.failure(new ReferenceItemNotFoundError());
    }

    let name: ReferenceName;
    let statBonus: StatBonus | null;
    try {
      name = ReferenceName.create(command.name);
      statBonus = buildStatBonus(command.stat, command.bonus);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    // Unicité (group_id, name) : on autorise le nom inchangé (même item) ; sinon un autre item du
    // groupe ne doit pas déjà porter ce nom.
    const nameChanged = name.value !== existing.name.value;
    if (nameChanged && (await this.repository.existsByGroupAndName(command.groupId, name.value))) {
      return Result.failure(new ReferenceNameAlreadyUsedError());
    }

    // Compétences à rattacher : pertinent uniquement pour les formations (deps présentes).
    const formationDeps = this.formationDeps;
    const competenceIds = formationDeps !== undefined ? (command.competenceIds ?? []) : [];

    // Chaque compétence doit exister dans le **même groupe** (portée + intégrité du lien).
    if (formationDeps !== undefined) {
      for (const competenceId of competenceIds) {
        const exists = await formationDeps.competences.existsInGroup(command.groupId, competenceId);
        if (!exists) {
          return Result.failure(new ReferenceItemNotFoundError());
        }
      }
    }

    // Reconstruit l'élément avec son identité d'origine (id/groupId/createdAt) et le nouvel état.
    // On passe par `create` (et non `restore`) pour que le NOUVEL état utilisateur soit normalisé
    // et validé (ex : points de protection non finis rejetés en INVALID_PROTECTION_POINTS → 400).
    const updatedResult = tryCreateValueObject(() =>
      ReferenceItem.create({
        id: existing.id,
        groupId: existing.groupId,
        name,
        createdAt: existing.createdAt,
        statBonus,
        protectionPoints: command.protectionPoints ?? null,
        description: command.description ?? null,
      }),
    );
    if (updatedResult.isFailure) return Result.failure(updatedResult.error);
    const updated = updatedResult.value;

    await this.unitOfWork.execute(async (repos) => {
      await this.selectRepo(repos).update(updated);
      if (formationDeps !== undefined) {
        // Remplacement complet : on efface tous les liens existants puis on réinsère la liste.
        const links = formationDeps.formationCompetences(repos);
        await links.deleteByFormation(updated.id);
        for (const competenceId of competenceIds) {
          await links.link(updated.id, competenceId, new Date());
        }
      }
    });

    this.logger.info("Élément de référence modifié", {
      itemId: updated.id,
      groupId: updated.groupId,
    });

    return Result.success(toView(updated, competenceIds));
  }
}

/** Use case **générique** « lister les éléments de référence d'un groupe ». Lecture pure. */
export class ListReferenceItemsUseCaseImpl implements ListReferenceItemsUseCase {
  /**
   * @param repository - Catalogue du type géré (lecture).
   * @param groupAccessService - Vérifie que l'acteur est membre du groupe.
   * @param formationDeps - Dépendances spécifiques aux formations (liaison compétences). Absentes
   *                        pour les autres types : `competenceIds` est alors toujours vide.
   */
  constructor(
    private readonly repository: ReferenceRepository,
    private readonly groupAccessService: GroupAccessService,
    private readonly formationDeps?: FormationListDeps,
  ) {}

  public async execute(
    query: ListReferenceItemsQuery,
  ): Promise<Result<ReferenceItemView[], AppError>> {
    const accessResult = await this.groupAccessService.requireMember(query.actorId, query.groupId);
    if (accessResult.isFailure) return Result.failure(accessResult.error);

    const items = await this.repository.findByGroupId(query.groupId);

    if (this.formationDeps === undefined) {
      return Result.success(items.map((item) => toView(item)));
    }

    const links = this.formationDeps.formationCompetences;
    const views: ReferenceItemView[] = [];
    for (const item of items) {
      const competenceIds = await links.findCompetenceIdsByFormation(item.id);
      views.push(toView(item, competenceIds));
    }
    return Result.success(views);
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
