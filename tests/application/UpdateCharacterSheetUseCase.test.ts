import { describe, it, expect, beforeEach } from "vitest";
import { UpdateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/UpdateCharacterSheetUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCharacterSheet,
  buildTestReferenceItem,
  buildTestMembership,
} from "./fakes";
import { FakeRealtimeNotifier } from "./serviceFakes";

describe("UpdateCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: UpdateCharacterSheetUseCaseImpl;

  function buildUpdateUseCase(
    repos: ReturnType<typeof buildFakeTransactionalRepositories>,
    notifier?: FakeRealtimeNotifier,
  ): UpdateCharacterSheetUseCaseImpl {
    const groupAccessService = new GroupAccessServiceImpl(
      repos.groupMembers,
      repos.campaigns,
      repos.campaignCharacters,
    );
    return new UpdateCharacterSheetUseCaseImpl({
      characterSheetRepository: repos.characterSheets,
      formationRepository: repos.formations,
      peupleRepository: repos.peoples,
      groupAccessService,
      unitOfWork: new FakeUnitOfWork(repos),
      logger: new FakeLogger(),
      realtimeNotifier: notifier ?? new FakeRealtimeNotifier(),
    });
  }

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "owner-1" }));
    useCase = buildUpdateUseCase(txRepos);
  });

  it("met à jour le nom et les champs détaillés (dont la formation N‑1), en préservant id/ownerId/createdAt", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1", "Aragorn"));
    txRepos.peoples.seed(buildTestReferenceItem("peuple-1", "group-1", "Dúnedain"));

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "Strider",
      peupleId: "peuple-1",
      vigueur: 7,
      notes: "  Garde du Nord  ",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Strider");
    expect(result.value.peupleId).toBe("peuple-1");
    expect(result.value.vigueur).toBe(7);
    expect(result.value.notes).toBe("Garde du Nord"); // trim
    expect(result.value.id).toBe("s-1");
    expect(result.value.ownerId).toBe("owner-1");

    const persisted = await txRepos.characterSheets.findById("s-1");
    expect(persisted!.name.value).toBe("Strider");
    expect(persisted!.details.vigueur).toBe(7);
  });

  it("ne persiste PAS pointsDeVie/protection envoyés par le client (valeurs dérivées)", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", { vigueur: 4 }),
    );

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "Aragorn",
      vigueur: 4,
      pointsDeVie: 999,
      protection: 999,
    });

    expect(result.isSuccess).toBe(true);
    // Les colonnes dérivées ne reflètent jamais l'input client (ici elles restent à null,
    // état initial de la fiche) : elles seront recalculées à la lecture.
    const persisted = await txRepos.characterSheets.findById("s-1");
    expect(persisted!.details.pointsDeVie).toBeNull();
    expect(persisted!.details.protection).toBeNull();
  });

  it("refuse (REFERENCE_ITEM_NOT_FOUND) une formation/peuple d'un autre propriétaire", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1", "Aragorn"));
    txRepos.peoples.seed(buildTestReferenceItem("peuple-x", "group-autre", "Elfe"));

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "Aragorn",
      peupleId: "peuple-x",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("REFERENCE_ITEM_NOT_FOUND");
  });

  it("normalise les entiers négatifs à 0", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "Aragorn",
      vigueur: -50,
    });

    expect(result.value.vigueur).toBe(0);
  });

  it("met à jour sexe (VO) et purse", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1", "Aragorn"));
    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "Aragorn",
      niveau: 5,
      age: 87,
      sexe: "m",
      purse: { gold: 1, silver: 150, copper: 0 },
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.niveau).toBe(5);
    expect(result.value.age).toBe(87);
    expect(result.value.sexe).toBe("M");
    expect(result.value.purse).toEqual({ gold: 1, silver: 150, copper: 0 });
  });

  it("échoue avec InvalidInputError si le sexe est invalide", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));
    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "X",
      sexe: "Z",
    });
    expect(result.error).toBeInstanceOf(InvalidInputError);
  });

  it("échoue avec InvalidInputError si la bourse est négative", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));
    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "X",
      purse: { gold: -1 },
    });
    expect(result.error).toBeInstanceOf(InvalidInputError);
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche n'existe pas", async () => {
    const result = await useCase.execute({
      characterSheetId: "ghost",
      ownerId: "owner-1",
      name: "X",
    });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("autorise un ADMIN du groupe à modifier la fiche (non-propriétaire)", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1"),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "admin-1", role: GroupRole.ADMIN }),
    );

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "admin-1",
      name: "Strider",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Strider");
  });

  it("autorise un MJ du groupe à modifier la fiche (non-propriétaire)", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1"),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "mj-1", role: GroupRole.MJ }),
    );

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "mj-1",
      name: "Strider",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe("Strider");
  });

  it("échoue avec CharacterSheetAccessDeniedError si le demandeur est MEMBER non-propriétaire", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1"),
    );
    txRepos.groupMembers.seed(
      buildTestMembership({ groupId: "group-1", userId: "autre", role: GroupRole.MEMBER }),
    );

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "autre",
      name: "X",
    });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("échoue avec InvalidInputError si le nom est invalide", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "   ",
    });

    expect(result.error).toBeInstanceOf(InvalidInputError);
  });

  it("notifie le canal sheet après une mise à jour réussie", async () => {
    const notifier = new FakeRealtimeNotifier();
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1", "Aragorn"));
    const uc = buildUpdateUseCase(txRepos, notifier);

    const result = await uc.execute({
      characterSheetId: "s-1",
      ownerId: "owner-1",
      name: "Strider",
    });

    expect(result.isSuccess).toBe(true);
    expect(notifier.notifications).toContainEqual({
      kind: "sheet",
      id: "s-1",
      resource: "character-sheet-detail",
    });
  });

  it("ne notifie pas le canal sheet si la mise à jour échoue", async () => {
    const notifier = new FakeRealtimeNotifier();
    const uc = buildUpdateUseCase(txRepos, notifier);

    // fiche inexistante → échec
    const result = await uc.execute({
      characterSheetId: "ghost",
      ownerId: "owner-1",
      name: "X",
    });

    expect(result.isFailure).toBe(true);
    expect(notifier.notifications.filter((n) => n.kind === "sheet")).toHaveLength(0);
  });
});
