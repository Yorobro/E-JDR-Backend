import { describe, it, expect, beforeEach } from "vitest";
import {
  CreateReferenceItemUseCaseImpl,
  ListReferenceItemsUseCaseImpl,
} from "@application/features/reference/usecases/ReferenceCatalogueUseCaseImpls";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
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
