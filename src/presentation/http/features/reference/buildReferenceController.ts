import { Logger } from "@application/shared/Logger";
import { TransactionalRepositories, UnitOfWork } from "@application/shared/UnitOfWork";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { SheetReferenceLinkRepository } from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";
import {
  CreateReferenceItemUseCaseImpl,
  DeleteReferenceItemUseCaseImpl,
  ListReferenceItemsUseCaseImpl,
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
  >;
  readonly idGenerator: IdGeneratorService;
  readonly unitOfWork: UnitOfWork;
  readonly logger: Logger;
}

/** Sélecteur de repository catalogue dans une transaction (par clé de `TransactionalRepositories`). */
type CatalogueKey = "formations" | "peoples" | "armes" | "armures" | "competences" | "equipements";
/** Sélecteur de repository de liaison dans une transaction. */
type LinkKey = "sheetArmes" | "sheetArmures" | "sheetCompetences" | "sheetEquipements";

/**
 * Assemble le controller référence générique : pour chacun des 6 catalogues et 4 liaisons, câble
 * les use cases sur le repository (lecture) et le sélecteur transactionnel (écriture) adéquats.
 *
 * Extrait du composition root pour garder `main.ts` sous la limite de taille (`ejdr/file-size`).
 *
 * @param deps - Les services partagés produits par le composition root.
 * @returns Le controller référence prêt à monter.
 */
export function buildReferenceController(deps: ReferenceControllerDeps): ReferenceController {
  const catalogue = (repo: ReferenceRepository, key: CatalogueKey): CatalogueUseCases => ({
    create: new CreateReferenceItemUseCaseImpl(
      repo,
      (repos) => repos[key],
      deps.idGenerator,
      deps.unitOfWork,
      deps.logger,
    ),
    list: new ListReferenceItemsUseCaseImpl(repo),
    remove: new DeleteReferenceItemUseCaseImpl(
      repo,
      (repos) => repos[key],
      deps.unitOfWork,
      deps.logger,
    ),
  });

  const link = (
    itemRepo: ReferenceRepository,
    linkRepo: SheetReferenceLinkRepository,
    key: LinkKey,
  ): LinkUseCases => ({
    link: new LinkSheetReferenceUseCaseImpl(
      deps.characterSheetRepository,
      itemRepo,
      linkRepo,
      (repos) => repos[key],
      deps.unitOfWork,
      deps.logger,
    ),
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
