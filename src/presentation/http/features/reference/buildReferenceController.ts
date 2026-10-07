import { Logger } from "@application/shared/Logger";
import { TransactionalRepositories, UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { SheetReferenceLinkRepository } from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";
import {
  CreateReferenceItemUseCaseImpl,
  DeleteReferenceItemUseCaseImpl,
  ListReferenceItemsUseCaseImpl,
  UpdateReferenceItemUseCaseImpl,
} from "@application/features/reference/usecases/ReferenceCatalogueUseCaseImpls";
import {
  LinkSheetReferenceUseCaseImpl,
  ListSheetReferencesUseCaseImpl,
  UnlinkSheetReferenceUseCaseImpl,
} from "@application/features/reference/usecases/SheetReferenceLinkUseCaseImpls";
import {
  CatalogueUseCases,
  LinkUseCases,
  ReferenceController,
} from "@presentation/http/features/reference/controllers/ReferenceController";

/** Services partagés requis pour assembler la feature référence. */
export interface ReferenceControllerDeps {
  readonly characterSheetRepository: CharacterSheetRepository;
  readonly references: Pick<
    TransactionalRepositories,
    | "formations"
    | "peoples"
    | "armes"
    | "armures"
    | "competences"
    | "equipements"
    | "sorts"
    | "miracles"
    | "sheetArmes"
    | "sheetArmures"
    | "sheetCompetences"
    | "sheetEquipements"
    | "sheetSorts"
    | "sheetMiracles"
    | "formationCompetences"
    | "peupleStatBonuses"
  >;
  readonly idGenerator: IdGeneratorService;
  readonly groupAccessService: GroupAccessService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
  readonly realtimeNotifier: RealtimeNotifier;
}

type CatalogueKey =
  | "formations"
  | "peoples"
  | "armes"
  | "armures"
  | "competences"
  | "equipements"
  | "sorts"
  | "miracles";
type LinkKey =
  | "sheetArmes"
  | "sheetArmures"
  | "sheetCompetences"
  | "sheetEquipements"
  | "sheetSorts"
  | "sheetMiracles";

/**
 * Assemble les 4 use cases d'un catalogue.
 *
 * Les dépendances propres à un type ne sont branchées que sur ce type — et leur **présence** est ce
 * qui fait basculer le use case dans le mode correspondant :
 * - `formations` → compétences liées (N‑N) ;
 * - `peoples` → bonus de statistique multiples (0..N, au plus un par stat), et les colonnes
 *   historiques `stat`/`bonus` cessent alors d'être écrites (elles seraient comptées deux fois).
 *
 * Les six autres types passent `undefined` sur les deux et ignorent ces champs.
 */
function buildCatalogueUseCases(
  deps: ReferenceControllerDeps,
  repo: ReferenceRepository,
  key: CatalogueKey,
): CatalogueUseCases {
  const formationCreateDeps = {
    competences: deps.references.competences,
    formationCompetences: (repos: TransactionalRepositories) => repos.formationCompetences,
  };
  const peupleWriteDeps = {
    peupleStatBonuses: (repos: TransactionalRepositories) => repos.peupleStatBonuses,
  };

  const isFormations = key === "formations";
  const isPeoples = key === "peoples";
  const formationDeps = isFormations ? formationCreateDeps : undefined;
  const peupleDeps = isPeoples ? peupleWriteDeps : undefined;

  return {
    create: new CreateReferenceItemUseCaseImpl({
      repository: repo,
      selectRepo: (repos) => repos[key],
      idGenerator: deps.idGenerator,
      groupAccessService: deps.groupAccessService,
      unitOfWork: deps.unitOfWork,
      logger: deps.logger,
      realtimeNotifier: deps.realtimeNotifier,
      formationDeps,
      peupleDeps,
    }),
    list: new ListReferenceItemsUseCaseImpl(
      repo,
      deps.groupAccessService,
      isFormations ? { formationCompetences: deps.references.formationCompetences } : undefined,
      isPeoples ? { peupleStatBonuses: deps.references.peupleStatBonuses } : undefined,
    ),
    update: new UpdateReferenceItemUseCaseImpl({
      repository: repo,
      selectRepo: (repos) => repos[key],
      groupAccessService: deps.groupAccessService,
      unitOfWork: deps.unitOfWork,
      logger: deps.logger,
      realtimeNotifier: deps.realtimeNotifier,
      formationDeps,
      peupleDeps,
    }),
    remove: new DeleteReferenceItemUseCaseImpl(
      repo,
      (repos) => repos[key],
      deps.groupAccessService,
      deps.unitOfWork,
      deps.logger,
      deps.realtimeNotifier,
    ),
  };
}

export function buildReferenceController(deps: ReferenceControllerDeps): ReferenceController {
  const catalogue = (repo: ReferenceRepository, key: CatalogueKey): CatalogueUseCases =>
    buildCatalogueUseCases(deps, repo, key);

  const link = (
    itemRepo: ReferenceRepository,
    linkRepo: SheetReferenceLinkRepository,
    key: LinkKey,
  ): LinkUseCases => ({
    link: new LinkSheetReferenceUseCaseImpl({
      characterSheetRepository: deps.characterSheetRepository,
      itemRepository: itemRepo,
      linkRepository: linkRepo,
      selectLinkRepo: (repos) => repos[key],
      groupAccessService: deps.groupAccessService,
      unitOfWork: deps.unitOfWork,
      logger: deps.logger,
    }),
    unlink: new UnlinkSheetReferenceUseCaseImpl(
      deps.characterSheetRepository,
      (repos) => repos[key],
      deps.unitOfWork,
      deps.logger,
    ),
    list: new ListSheetReferencesUseCaseImpl(deps.characterSheetRepository, linkRepo),
  });

  const r = deps.references;
  const catalogues: Record<string, CatalogueUseCases> = {
    formations: catalogue(r.formations, "formations"),
    peoples: catalogue(r.peoples, "peoples"),
    armes: catalogue(r.armes, "armes"),
    armures: catalogue(r.armures, "armures"),
    competences: catalogue(r.competences, "competences"),
    equipements: catalogue(r.equipements, "equipements"),
    sorts: catalogue(r.sorts, "sorts"),
    miracles: catalogue(r.miracles, "miracles"),
  };
  const links: Record<string, LinkUseCases> = {
    armes: link(r.armes, r.sheetArmes, "sheetArmes"),
    armures: link(r.armures, r.sheetArmures, "sheetArmures"),
    competences: link(r.competences, r.sheetCompetences, "sheetCompetences"),
    equipements: link(r.equipements, r.sheetEquipements, "sheetEquipements"),
    sorts: link(r.sorts, r.sheetSorts, "sheetSorts"),
    miracles: link(r.miracles, r.sheetMiracles, "sheetMiracles"),
  };

  return new ReferenceController(catalogues, links);
}
