import { describe, it, expect, beforeEach } from "vitest";
import { CreateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/CreateCharacterSheetUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestMembership,
} from "./fakes";

describe("CreateCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: CreateCharacterSheetUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const groupAccessService = new GroupAccessServiceImpl(txRepos.groupMembers);
    useCase = new CreateCharacterSheetUseCaseImpl(
      new FakeIdGenerator(),
      groupAccessService,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
    // user-1 est membre du groupe group-1.
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "user-1" }));
  });

  it("crée une fiche appartenant à l'utilisateur et au groupe actif", async () => {
    const result = await useCase.execute({
      ownerId: "user-1",
      groupId: "group-1",
      name: "  Gimli  ",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Gimli");
    const stored = await txRepos.characterSheets.findByGroupId("group-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.ownerId).toBe("user-1");
    expect(stored[0]!.groupId).toBe("group-1");
  });

  it("échoue avec NOT_GROUP_MEMBER si l'utilisateur n'est pas membre du groupe", async () => {
    const result = await useCase.execute({
      ownerId: "user-1",
      groupId: "group-inconnu",
      name: "Gimli",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("NOT_GROUP_MEMBER");
    expect(await txRepos.characterSheets.findByGroupId("group-inconnu")).toHaveLength(0);
  });

  it("échoue avec InvalidInputError si le nom est vide", async () => {
    const result = await useCase.execute({ ownerId: "user-1", groupId: "group-1", name: "   " });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_CHARACTER_SHEET_NAME");
    expect(await txRepos.characterSheets.findByGroupId("group-1")).toHaveLength(0);
  });
});
