import { Logger } from "@application/shared/Logger";
import { TransactionalRepositories, UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
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
    | "sheetArmes"
    | "sheetArmures"
    | "sheetCompetences"
    | "sheetEquipements"
    | "formationCompetences"
  >;
  readonly idGenerator: IdGeneratorService;
  readonly groupAccessService: GroupAccessService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
}

type CatalogueKey = "formations" | "peoples" | "armes" | "armures" | "competences" | "equipements";
type LinkKey = "sheetArmes" | "sheetArmures" | "sheetCompetences" | "sheetEquipements";

export function buildReferenceController(deps: ReferenceControllerDeps): ReferenceController {
  // Dépendances spécifiques aux formations : catalogue de compétences (vérification de portée) +
  // liaison transactionnelle formation↔compétences. Branchées uniquement sur le catalogue
  // `formations` ; les autres types passent `undefined`.
  const formationCreateDeps = {
    competences: deps.references.competences,
    formationCompetences: (repos: TransactionalRepositories) => repos.formationCompetences,
  };
  const formationListDeps = { formationCompetences: deps.references.formationCompetences };

  const catalogue = (repo: ReferenceRepository, key: CatalogueKey): CatalogueUseCases => {
    const isFormations = key === "formations";
    return {
      create: new CreateReferenceItemUseCaseImpl({
        repository: repo,
        selectRepo: (repos) => repos[key],
        idGenerator: deps.idGenerator,
        groupAccessService: deps.groupAccessService,
        unitOfWork: deps.unitOfWork,
        logger: deps.logger,
        formationDeps: isFormations ? formationCreateDeps : undefined,
      }),
      list: new ListReferenceItemsUseCaseImpl(
        repo,
        deps.groupAccessService,
        isFormations ? formationListDeps : undefined,
      ),
      update: new UpdateReferenceItemUseCaseImpl({
        repository: repo,
        selectRepo: (repos) => repos[key],
        groupAccessService: deps.groupAccessService,
        unitOfWork: deps.unitOfWork,
        logger: deps.logger,
        formationDeps: isFormations ? formationCreateDeps : undefined,
      }),
      remove: new DeleteReferenceItemUseCaseImpl(
        repo,
        (repos) => repos[key],
        deps.groupAccessService,
        deps.unitOfWork,
        deps.logger,
      ),
    };
  };

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
  };
  const links: Record<string, LinkUseCases> = {
    armes: link(r.armes, r.sheetArmes, "sheetArmes"),
    armures: link(r.armures, r.sheetArmures, "sheetArmures"),
    competences: link(r.competences, r.sheetCompetences, "sheetCompetences"),
    equipements: link(r.equipements, r.sheetEquipements, "sheetEquipements"),
  };

  return new ReferenceController(catalogues, links);
}
