import { describe, it, expect, beforeEach } from "vitest";
import { CreateGroupUseCaseImpl } from "@application/features/friend-group/usecases/CreateGroupUseCaseImpl";
import {
  buildFakeTransactionalRepositories,
  FakeUnitOfWork,
  FakeLogger,
  FakeIdGenerator,
} from "./fakes";

describe("CreateGroupUseCase", () => {
  let repos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: CreateGroupUseCaseImpl;

  beforeEach(() => {
    repos = buildFakeTransactionalRepositories();
    useCase = new CreateGroupUseCaseImpl(
      new FakeIdGenerator(),
      new FakeUnitOfWork(repos),
      new FakeLogger(),
    );
  });

  it("crée un groupe et rend le créateur ADMIN", async () => {
    const result = await useCase.execute({ createdBy: "user-1", name: "Les Héros" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Les Héros");

    const group = await repos.friendGroups.findById(result.value.id);
    expect(group).not.toBeNull();

    const membership = await repos.groupMembers.findByUserIdAndGroupId("user-1", result.value.id);
    expect(membership?.role.value).toBe("ADMIN");
  });

  it("échoue si le nom est vide", async () => {
    const result = await useCase.execute({ createdBy: "user-1", name: "  " });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("INVALID_GROUP_NAME");
  });

  it("normalise le nom", async () => {
    const result = await useCase.execute({ createdBy: "user-1", name: "  Mon Groupe  " });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Mon Groupe");
  });
});
