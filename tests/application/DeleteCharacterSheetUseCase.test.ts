import { describe, it, expect, beforeEach } from "vitest";
import { DeleteCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/DeleteCharacterSheetUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import {
  FakeLogger,
  FakeUnitOfWork,
  FakeRealtimeNotifier,
  buildFakeTransactionalRepositories,
  buildTestCharacterSheet,
  buildTestMembership,
} from "./fakes";

describe("DeleteCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let notifier: FakeRealtimeNotifier;
  let useCase: DeleteCharacterSheetUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    notifier = new FakeRealtimeNotifier();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.characterSheets,
    );
    useCase = new DeleteCharacterSheetUseCaseImpl(
      txRepos.characterSheets,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
      groupAccessService,
      notifier,
    );
  });

  it("supprime la fiche si le demandeur en est le propriétaire (même MEMBER du groupe)", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1"),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "owner-1", role: GroupRole.MEMBER }),
    );

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "owner-1" });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.characterSheets.findById("s-1")).toBeNull();
  });

  it("supprime la fiche si le demandeur est ADMIN du groupe (non-propriétaire)", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1"),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "admin-1", role: GroupRole.ADMIN }),
    );

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "admin-1" });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.characterSheets.findById("s-1")).toBeNull();
  });

  it("supprime la fiche si le demandeur est MJ du groupe (non-propriétaire)", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1"),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.MJ }),
    );

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.characterSheets.findById("s-1")).toBeNull();
  });

  it("notifie le PROPRIÉTAIRE de la fiche après suppression par un ADMIN tiers", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1"),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "admin-1", role: GroupRole.ADMIN }),
    );

    await useCase.execute({ characterSheetId: "s-1", ownerId: "admin-1" });

    // C'est la liste « Mes fiches » du propriétaire (owner-1) qui doit se rafraîchir,
    // pas celle de l'admin qui a déclenché la suppression.
    expect(notifier.notifications).toEqual([
      { kind: "user", id: "owner-1", resource: "character-sheets" },
    ]);
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche n'existe pas", async () => {
    const result = await useCase.execute({ characterSheetId: "ghost", ownerId: "owner-1" });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
    expect(notifier.notifications).toHaveLength(0);
  });

  it("échoue avec CharacterSheetAccessDeniedError si le demandeur est MEMBER non-propriétaire", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1"),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "autre", role: GroupRole.MEMBER }),
    );

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "autre" });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
    expect(await txRepos.characterSheets.findById("s-1")).not.toBeNull();
  });
});
