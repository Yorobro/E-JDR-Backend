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
    groupAccessService = new GroupAccessServiceImpl(txRepos.groupMembers);
    // u-1 est admin de group-1 (membre seulement de group-1)
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "u-1" }));
  });

  function createUseCase(): CreateReferenceItemUseCaseImpl {
    return new CreateReferenceItemUseCaseImpl(
      txRepos.armes,
      (repos) => repos.armes,
      new FakeIdGenerator(),
      groupAccessService,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
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
