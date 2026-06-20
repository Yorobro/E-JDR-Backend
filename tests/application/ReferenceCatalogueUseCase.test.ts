import { describe, it, expect, beforeEach } from "vitest";
import {
  CreateReferenceItemUseCaseImpl,
  DeleteReferenceItemUseCaseImpl,
  ListReferenceItemsUseCaseImpl,
} from "@application/features/reference/usecases/ReferenceCatalogueUseCaseImpls";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { ReferenceNameAlreadyUsedError } from "@application/features/reference/errors/ReferenceNameAlreadyUsedError";
import { ReferenceItemNotFoundError } from "@application/features/reference/errors/ReferenceItemNotFoundError";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestReferenceItem,
  buildTestMembership,
} from "./fakes";

describe("Reference catalogue use cases (génériques, testés sur le type `armes`)", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let groupAccessService: GroupAccessServiceImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    // u-1 est admin de group-1 (membre seulement de group-1)
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "u-1" }));
  });

  function createUseCase(): CreateReferenceItemUseCaseImpl {
    return new CreateReferenceItemUseCaseImpl({
      repository: txRepos.armes,
      selectRepo: (repos) => repos.armes,
      idGenerator: new FakeIdGenerator(),
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
    });
  }

  it("crée un élément dans le groupe si l'acteur en est admin", async () => {
    const result = await createUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "  Épée longue  ",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Épée longue");
    expect(await txRepos.armes.findByGroupId("group-1")).toHaveLength(1);
  });

  it("refuse (409) un doublon de nom dans le même groupe", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Dague"));

    const result = await createUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Dague",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(ReferenceNameAlreadyUsedError);
  });

  it("autorise le même nom dans deux groupes différents", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-autre", "Dague"));

    const result = await createUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Dague",
    });

    expect(result.isSuccess).toBe(true);
  });

  it("échoue (INVALID_REFERENCE_NAME) si le nom est vide", async () => {
    const result = await createUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "   ",
    });

    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_REFERENCE_NAME");
  });

  it("liste uniquement les éléments du groupe", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));
    txRepos.armes.seed(buildTestReferenceItem("a-2", "group-1", "Hache"));
    txRepos.armes.seed(buildTestReferenceItem("a-3", "group-autre", "Arc"));

    const result = await new ListReferenceItemsUseCaseImpl(
      txRepos.armes,
      groupAccessService,
    ).execute({
      groupId: "group-1",
      actorId: "u-1",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.map((i) => i.name).sort()).toEqual(["Hache", "Épée"]);
  });

  it("crée un élément sans stat ni bonus (stat/bonus null dans la vue)", async () => {
    const result = await createUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Épée longue",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.stat).toBeNull();
    expect(result.value.bonus).toBeNull();
    expect(result.value.protectionPoints).toBeNull();
    expect(result.value.competenceIds).toEqual([]);
  });

  it("crée une armure avec points de protection (la vue les renvoie)", async () => {
    const result = await createUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Cotte de mailles",
      protectionPoints: 3,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.protectionPoints).toBe(3);
  });

  it("crée une armure sans points de protection (protectionPoints null)", async () => {
    const result = await createUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Tunique",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.protectionPoints).toBeNull();
  });

  it("clampe à 0 des points de protection négatifs", async () => {
    const result = await createUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Armure cabossée",
      protectionPoints: -5,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.protectionPoints).toBe(0);
  });

  it("liste les armures avec leurs points de protection (round-trip via la vue)", async () => {
    await createUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Plastron",
      protectionPoints: 4,
    });

    const result = await new ListReferenceItemsUseCaseImpl(
      txRepos.armes,
      groupAccessService,
    ).execute({ groupId: "group-1", actorId: "u-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.protectionPoints).toBe(4);
  });

  it("supprime un élément du groupe si l'acteur en est admin", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));
    const useCase = new DeleteReferenceItemUseCaseImpl(
      txRepos.armes,
      (repos) => repos.armes,
      groupAccessService,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );

    const result = await useCase.execute({ itemId: "a-1", actorId: "u-1" });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.armes.findById("a-1")).toBeNull();
  });

  it("échoue (404) à la suppression d'un élément inexistant ou d'un autre groupe", async () => {
    // a-1 appartient à group-autre : u-1 n'en est pas admin → 404 (ne révèle pas l'existence)
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-autre", "Épée"));
    const useCase = new DeleteReferenceItemUseCaseImpl(
      txRepos.armes,
      (repos) => repos.armes,
      groupAccessService,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );

    const ghost = await useCase.execute({ itemId: "ghost", actorId: "u-1" });
    const others = await useCase.execute({ itemId: "a-1", actorId: "u-1" });

    expect(ghost.error).toBeInstanceOf(ReferenceItemNotFoundError);
    expect(others.error).toBeInstanceOf(ReferenceItemNotFoundError);
    expect(await txRepos.armes.findById("a-1")).not.toBeNull();
  });
});

describe("Reference catalogue use cases — bonus de stat + compétences (formations/peuples)", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let groupAccessService: GroupAccessServiceImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "u-1" }));
  });

  function createFormationUseCase(): CreateReferenceItemUseCaseImpl {
    return new CreateReferenceItemUseCaseImpl({
      repository: txRepos.formations,
      selectRepo: (repos) => repos.formations,
      idGenerator: new FakeIdGenerator(),
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
      formationDeps: {
        competences: txRepos.competences,
        formationCompetences: (repos) => repos.formationCompetences,
      },
    });
  }

  function createPeupleUseCase(): CreateReferenceItemUseCaseImpl {
    return new CreateReferenceItemUseCaseImpl({
      repository: txRepos.peoples,
      selectRepo: (repos) => repos.peoples,
      idGenerator: new FakeIdGenerator(),
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
    });
  }

  it("crée une formation avec stat + bonus explicite", async () => {
    const result = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Guerrier",
      stat: "vigueur",
      bonus: 3,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.stat).toBe("vigueur");
    expect(result.value.bonus).toBe(3);
  });

  it("applique le bonus par défaut de 1 si stat fournie sans montant", async () => {
    const result = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Éclaireur",
      stat: "perception",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.stat).toBe("perception");
    expect(result.value.bonus).toBe(1);
  });

  it("crée un peuple avec stat + bonus", async () => {
    const result = await createPeupleUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Nain",
      stat: "vigueur",
      bonus: 2,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.stat).toBe("vigueur");
    expect(result.value.bonus).toBe(2);
  });

  it("échoue (INVALID_STAT_BONUS) si la stat est hors liste", async () => {
    const result = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Mage",
      stat: "force",
    });

    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_STAT_BONUS");
  });

  it("échoue (INVALID_STAT_BONUS) si le bonus est < 1", async () => {
    const result = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Mage",
      stat: "intelligence",
      bonus: 0,
    });

    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_STAT_BONUS");
  });

  it("crée une formation avec des compétences existantes du même groupe (liens persistés)", async () => {
    txRepos.competences.seed(buildTestReferenceItem("c-1", "group-1", "Escrime"));
    txRepos.competences.seed(buildTestReferenceItem("c-2", "group-1", "Esquive"));

    const result = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Bretteur",
      competenceIds: ["c-1", "c-2"],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.competenceIds.sort()).toEqual(["c-1", "c-2"]);
    expect(
      (await txRepos.formationCompetences.findCompetenceIdsByFormation(result.value.id)).sort(),
    ).toEqual(["c-1", "c-2"]);
  });

  it("refuse (404) une formation référençant une compétence d'un autre groupe", async () => {
    txRepos.competences.seed(buildTestReferenceItem("c-1", "group-autre", "Escrime"));

    const result = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Bretteur",
      competenceIds: ["c-1"],
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(ReferenceItemNotFoundError);
    expect(await txRepos.formations.findByGroupId("group-1")).toHaveLength(0);
  });

  it("refuse (404) une formation référençant une compétence inexistante", async () => {
    const result = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Bretteur",
      competenceIds: ["ghost"],
    });

    expect(result.error).toBeInstanceOf(ReferenceItemNotFoundError);
  });

  it("liste les formations avec leurs stat/bonus et compétences liées", async () => {
    txRepos.competences.seed(buildTestReferenceItem("c-1", "group-1", "Escrime"));
    await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Guerrier",
      stat: "vigueur",
      bonus: 2,
      competenceIds: ["c-1"],
    });

    const result = await new ListReferenceItemsUseCaseImpl(txRepos.formations, groupAccessService, {
      formationCompetences: txRepos.formationCompetences,
    }).execute({ groupId: "group-1", actorId: "u-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(1);
    const formation = result.value[0]!;
    expect(formation.stat).toBe("vigueur");
    expect(formation.bonus).toBe(2);
    expect(formation.competenceIds).toEqual(["c-1"]);
  });
});

describe("Reference catalogue use cases — description (sorts/miracles)", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let groupAccessService: GroupAccessServiceImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "u-1" }));
  });

  function createSortUseCase(): CreateReferenceItemUseCaseImpl {
    return new CreateReferenceItemUseCaseImpl({
      repository: txRepos.sorts,
      selectRepo: (repos) => repos.sorts,
      idGenerator: new FakeIdGenerator(),
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
    });
  }

  it("crée un sort avec description (la vue la renvoie)", async () => {
    const result = await createSortUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Boule de feu",
      description: "Inflige 3d6 dégâts de feu dans une zone de 3 mètres.",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Boule de feu");
    expect(result.value.description).toBe("Inflige 3d6 dégâts de feu dans une zone de 3 mètres.");
  });

  it("crée un sort sans description (description null dans la vue)", async () => {
    const result = await createSortUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Lumière",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.description).toBeNull();
  });

  it("liste les miracles avec leur description (round-trip via la vue)", async () => {
    const createMiracle = new CreateReferenceItemUseCaseImpl({
      repository: txRepos.miracles,
      selectRepo: (repos) => repos.miracles,
      idGenerator: new FakeIdGenerator(),
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
    });
    await createMiracle.execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Guérison",
      description: "Rend 2d6 points de vie à une cible touchée.",
    });

    const result = await new ListReferenceItemsUseCaseImpl(
      txRepos.miracles,
      groupAccessService,
    ).execute({ groupId: "group-1", actorId: "u-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.description).toBe("Rend 2d6 points de vie à une cible touchée.");
  });
});
