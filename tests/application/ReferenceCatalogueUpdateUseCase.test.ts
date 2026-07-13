import { describe, it, expect, beforeEach } from "vitest";
import {
  CreateReferenceItemUseCaseImpl,
  UpdateReferenceItemUseCaseImpl,
} from "@application/features/reference/usecases/ReferenceCatalogueUseCaseImpls";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { ReferenceNameAlreadyUsedError } from "@application/features/reference/errors/ReferenceNameAlreadyUsedError";
import { ReferenceItemNotFoundError } from "@application/features/reference/errors/ReferenceItemNotFoundError";
import { NotGroupEditorError } from "@application/features/friend-group/errors/NotGroupEditorError";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  FakeRealtimeNotifier,
  buildFakeTransactionalRepositories,
  buildTestReferenceItem,
  buildTestMembership,
} from "./fakes";

describe("UpdateReferenceItemUseCase — types simples (testé sur `armes`)", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let groupAccessService: GroupAccessServiceImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.characterSheets,
    );
    // u-1 est admin de group-1
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "u-1" }));
  });

  function updateUseCase(): UpdateReferenceItemUseCaseImpl {
    return new UpdateReferenceItemUseCaseImpl({
      repository: txRepos.armes,
      selectRepo: (repos) => repos.armes,
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
      realtimeNotifier: new FakeRealtimeNotifier(),
    });
  }

  it("modifie le nom d'un élément si l'acteur est admin", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));

    const result = await updateUseCase().execute({
      itemId: "a-1",
      groupId: "group-1",
      actorId: "u-1",
      name: "Épée longue",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Épée longue");
    const stored = await txRepos.armes.findById("a-1");
    expect(stored!.name.value).toBe("Épée longue");
  });

  it("préserve id/groupId/createdAt d'origine lors de la modification", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));
    const before = await txRepos.armes.findById("a-1");

    await updateUseCase().execute({
      itemId: "a-1",
      groupId: "group-1",
      actorId: "u-1",
      name: "Épée longue",
    });

    const after = await txRepos.armes.findById("a-1");
    expect(after!.id).toBe("a-1");
    expect(after!.groupId).toBe("group-1");
    expect(after!.createdAt).toEqual(before!.createdAt);
  });

  it("autorise un nom inchangé (même item)", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));

    const result = await updateUseCase().execute({
      itemId: "a-1",
      groupId: "group-1",
      actorId: "u-1",
      name: "Épée",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Épée");
  });

  it("refuse (409) un nom dupliquant un AUTRE élément du groupe", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));
    txRepos.armes.seed(buildTestReferenceItem("a-2", "group-1", "Dague"));

    const result = await updateUseCase().execute({
      itemId: "a-1",
      groupId: "group-1",
      actorId: "u-1",
      name: "Dague",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(ReferenceNameAlreadyUsedError);
  });

  it("modifie les points de protection d'une armure (remplacement complet)", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Plastron", undefined, 2));

    const result = await updateUseCase().execute({
      itemId: "a-1",
      groupId: "group-1",
      actorId: "u-1",
      name: "Plastron",
      protectionPoints: 5,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.protectionPoints).toBe(5);
    const stored = await txRepos.armes.findById("a-1");
    expect(stored!.protectionPoints).toBe(5);
  });

  it("échoue (NOT_GROUP_EDITOR) si l'acteur est membre mais pas éditeur du groupe", async () => {
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "membre", role: GroupRole.MEMBER }),
    );
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-1", "Épée"));

    const result = await updateUseCase().execute({
      itemId: "a-1",
      groupId: "group-1",
      actorId: "membre",
      name: "Épée longue",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(NotGroupEditorError);
  });

  it("échoue (404) si l'élément est inconnu ou hors du groupe", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "group-autre", "Épée"));

    const ghost = await updateUseCase().execute({
      itemId: "ghost",
      groupId: "group-1",
      actorId: "u-1",
      name: "Peu importe",
    });
    const otherGroup = await updateUseCase().execute({
      itemId: "a-1",
      groupId: "group-1",
      actorId: "u-1",
      name: "Peu importe",
    });

    expect(ghost.error).toBeInstanceOf(ReferenceItemNotFoundError);
    expect(otherGroup.error).toBeInstanceOf(ReferenceItemNotFoundError);
  });
});

describe("UpdateReferenceItemUseCase — formations (stat/bonus + compétences)", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let groupAccessService: GroupAccessServiceImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.characterSheets,
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
      realtimeNotifier: new FakeRealtimeNotifier(),
      formationDeps: {
        competences: txRepos.competences,
        formationCompetences: (repos) => repos.formationCompetences,
      },
    });
  }

  function updateFormationUseCase(): UpdateReferenceItemUseCaseImpl {
    return new UpdateReferenceItemUseCaseImpl({
      repository: txRepos.formations,
      selectRepo: (repos) => repos.formations,
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
      realtimeNotifier: new FakeRealtimeNotifier(),
      formationDeps: {
        competences: txRepos.competences,
        formationCompetences: (repos) => repos.formationCompetences,
      },
    });
  }

  it("modifie une formation : stat/bonus changés et compétences ENTIÈREMENT remplacées", async () => {
    txRepos.competences.seed(buildTestReferenceItem("c-1", "group-1", "Escrime"));
    txRepos.competences.seed(buildTestReferenceItem("c-2", "group-1", "Esquive"));
    txRepos.competences.seed(buildTestReferenceItem("c-3", "group-1", "Parade"));

    // État initial : Guerrier (vigueur+2) avec [c-1, c-2].
    const created = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Guerrier",
      stat: "vigueur",
      bonus: 2,
      competenceIds: ["c-1", "c-2"],
    });
    const formationId = created.value.id;

    // Modification : nouveau nom, nouveau bonus, et compétences remplacées par [c-3] seul.
    const result = await updateFormationUseCase().execute({
      itemId: formationId,
      groupId: "group-1",
      actorId: "u-1",
      name: "Maître d'armes",
      stat: "dexterite",
      bonus: 3,
      competenceIds: ["c-3"],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Maître d'armes");
    expect(result.value.stat).toBe("dexterite");
    expect(result.value.bonus).toBe(3);
    expect(result.value.competenceIds).toEqual(["c-3"]);

    // Les anciens liens (c-1, c-2) ont été retirés ; seul c-3 subsiste.
    const links = await txRepos.formationCompetences.findCompetenceIdsByFormation(formationId);
    expect(links).toEqual(["c-3"]);
  });

  it("modifie une formation en retirant TOUTES ses compétences (liste vide)", async () => {
    txRepos.competences.seed(buildTestReferenceItem("c-1", "group-1", "Escrime"));
    const created = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Guerrier",
      competenceIds: ["c-1"],
    });

    const result = await updateFormationUseCase().execute({
      itemId: created.value.id,
      groupId: "group-1",
      actorId: "u-1",
      name: "Guerrier",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.competenceIds).toEqual([]);
    expect(
      await txRepos.formationCompetences.findCompetenceIdsByFormation(created.value.id),
    ).toEqual([]);
  });

  it("efface aussi le bonus de stat si la stat n'est plus fournie (remplacement complet)", async () => {
    const created = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Guerrier",
      stat: "vigueur",
      bonus: 2,
    });

    const result = await updateFormationUseCase().execute({
      itemId: created.value.id,
      groupId: "group-1",
      actorId: "u-1",
      name: "Guerrier",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.stat).toBeNull();
    expect(result.value.bonus).toBeNull();
  });

  it("refuse (404) une modif de formation référençant une compétence d'un autre groupe", async () => {
    const created = await createFormationUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Guerrier",
    });
    txRepos.competences.seed(buildTestReferenceItem("c-x", "group-autre", "Intrus"));

    const result = await updateFormationUseCase().execute({
      itemId: created.value.id,
      groupId: "group-1",
      actorId: "u-1",
      name: "Guerrier",
      competenceIds: ["c-x"],
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(ReferenceItemNotFoundError);
  });
});

describe("UpdateReferenceItemUseCase — bonus multiples d'un peuple", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let groupAccessService: GroupAccessServiceImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.characterSheets,
    );
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "u-1" }));
  });

  const peupleDeps = { peupleStatBonuses: (repos: typeof txRepos) => repos.peupleStatBonuses };

  function createPeupleUseCase(): CreateReferenceItemUseCaseImpl {
    return new CreateReferenceItemUseCaseImpl({
      repository: txRepos.peoples,
      selectRepo: (repos) => repos.peoples,
      idGenerator: new FakeIdGenerator(),
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
      realtimeNotifier: new FakeRealtimeNotifier(),
      peupleDeps,
    });
  }

  function updatePeupleUseCase(): UpdateReferenceItemUseCaseImpl {
    return new UpdateReferenceItemUseCaseImpl({
      repository: txRepos.peoples,
      selectRepo: (repos) => repos.peoples,
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(txRepos),
      logger: new FakeLogger(),
      realtimeNotifier: new FakeRealtimeNotifier(),
      peupleDeps,
    });
  }

  async function seedNain(): Promise<string> {
    const created = await createPeupleUseCase().execute({
      groupId: "group-1",
      actorId: "u-1",
      name: "Nain",
      statBonuses: [
        { stat: "vigueur", bonus: 2 },
        { stat: "social", bonus: 1 },
      ],
    });
    return created.value.id;
  }

  it("REMPLACE intégralement les bonus (les anciens disparaissent)", async () => {
    const id = await seedNain();

    const result = await updatePeupleUseCase().execute({
      itemId: id,
      groupId: "group-1",
      actorId: "u-1",
      name: "Nain",
      statBonuses: [{ stat: "perception", bonus: 3 }],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.statBonuses).toEqual([{ stat: "perception", bonus: 3 }]);
    const persisted = await txRepos.peupleStatBonuses.findByPeuple(id);
    expect(persisted.map((b) => b.stat)).toEqual(["perception"]);
  });

  it("supprime tous les bonus si statBonuses est absent (remplacement complet)", async () => {
    const id = await seedNain();

    const result = await updatePeupleUseCase().execute({
      itemId: id,
      groupId: "group-1",
      actorId: "u-1",
      name: "Nain",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.statBonuses).toEqual([]);
    expect(await txRepos.peupleStatBonuses.findByPeuple(id)).toEqual([]);
  });

  it("refuse (INVALID_STAT_BONUS) une stat en double, sans toucher aux bonus existants", async () => {
    const id = await seedNain();

    const result = await updatePeupleUseCase().execute({
      itemId: id,
      groupId: "group-1",
      actorId: "u-1",
      name: "Nain",
      statBonuses: [
        { stat: "social", bonus: 1 },
        { stat: "social", bonus: 4 },
      ],
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("INVALID_STAT_BONUS");
    // La validation échoue AVANT l'écriture : les bonus d'origine sont intacts.
    const persisted = await txRepos.peupleStatBonuses.findByPeuple(id);
    expect(persisted.map((b) => b.stat)).toEqual(["vigueur", "social"]);
  });
});
