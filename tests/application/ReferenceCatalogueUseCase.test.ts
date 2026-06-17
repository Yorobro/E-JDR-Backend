import { describe, it, expect, beforeEach } from "vitest";
import {
  CreateReferenceItemUseCaseImpl,
  DeleteReferenceItemUseCaseImpl,
  ListReferenceItemsUseCaseImpl,
} from "@application/features/reference/usecases/ReferenceCatalogueUseCaseImpls";
import { ReferenceNameAlreadyUsedError } from "@application/features/reference/errors/ReferenceNameAlreadyUsedError";
import { ReferenceItemNotFoundError } from "@application/features/reference/errors/ReferenceItemNotFoundError";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestReferenceItem,
} from "./fakes";

describe("Reference catalogue use cases (génériques, testés sur le type `armes`)", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
  });

  function createUseCase(): CreateReferenceItemUseCaseImpl {
    return new CreateReferenceItemUseCaseImpl(
      txRepos.armes,
      (repos) => repos.armes,
      new FakeIdGenerator(),
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
  }

  it("crée un élément pour le propriétaire courant", async () => {
    const result = await createUseCase().execute({ ownerId: "u-1", name: "  Épée longue  " });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Épée longue"); // trim par le VO
    expect(await txRepos.armes.findByOwnerId("u-1")).toHaveLength(1);
  });

  it("refuse (409) un doublon de nom pour le même propriétaire", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "u-1", "Dague"));

    const result = await createUseCase().execute({ ownerId: "u-1", name: "Dague" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(ReferenceNameAlreadyUsedError);
  });

  it("autorise le même nom pour deux propriétaires différents", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "autre", "Dague"));
    const result = await createUseCase().execute({ ownerId: "u-1", name: "Dague" });
    expect(result.isSuccess).toBe(true);
  });

  it("échoue (INVALID_REFERENCE_NAME) si le nom est vide", async () => {
    const result = await createUseCase().execute({ ownerId: "u-1", name: "   " });
    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_REFERENCE_NAME");
  });

  it("liste uniquement les éléments du propriétaire", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "u-1", "Épée"));
    txRepos.armes.seed(buildTestReferenceItem("a-2", "u-1", "Hache"));
    txRepos.armes.seed(buildTestReferenceItem("a-3", "autre", "Arc"));

    const result = await new ListReferenceItemsUseCaseImpl(txRepos.armes).execute({
      ownerId: "u-1",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.map((i) => i.name).sort()).toEqual(["Hache", "Épée"]);
  });

  it("supprime un élément possédé", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "u-1", "Épée"));
    const useCase = new DeleteReferenceItemUseCaseImpl(
      txRepos.armes,
      (repos) => repos.armes,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );

    const result = await useCase.execute({ itemId: "a-1", ownerId: "u-1" });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.armes.findById("a-1")).toBeNull();
  });

  it("échoue (404) à la suppression d'un élément inexistant ou d'autrui", async () => {
    txRepos.armes.seed(buildTestReferenceItem("a-1", "autre", "Épée"));
    const useCase = new DeleteReferenceItemUseCaseImpl(
      txRepos.armes,
      (repos) => repos.armes,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );

    const ghost = await useCase.execute({ itemId: "ghost", ownerId: "u-1" });
    const others = await useCase.execute({ itemId: "a-1", ownerId: "u-1" });

    expect(ghost.error).toBeInstanceOf(ReferenceItemNotFoundError);
    expect(others.error).toBeInstanceOf(ReferenceItemNotFoundError);
    // L'élément d'autrui n'a pas été supprimé.
    expect(await txRepos.armes.findById("a-1")).not.toBeNull();
  });
});
