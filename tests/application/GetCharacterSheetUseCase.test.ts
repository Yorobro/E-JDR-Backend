import { describe, it, expect, beforeEach } from "vitest";
import { GetCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/GetCharacterSheetUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import {
  FakeLogger,
  buildFakeTransactionalRepositories,
  buildTestCharacterSheet,
  buildTestMembership,
  buildTestReferenceItem,
} from "./fakes";

describe("GetCharacterSheetUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: GetCharacterSheetUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const groupAccessService = new GroupAccessServiceImpl(
      txRepos.groupMembers,
      txRepos.campaigns,
      txRepos.campaignCharacters,
    );
    useCase = new GetCharacterSheetUseCaseImpl({
      characterSheetRepository: txRepos.characterSheets,
      formationRepository: txRepos.formations,
      peupleRepository: txRepos.peoples,
      competenceRepository: txRepos.competences,
      formationCompetenceLink: txRepos.formationCompetences,
      groupAccessService,
      logger: new FakeLogger(),
    });
  });

  it("renvoie la fiche complète si le demandeur est membre du groupe de la fiche", async () => {
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", { peupleId: "peuple-1", vigueur: 6 }),
    );
    // « lecteur » est un autre membre du groupe (pas le propriétaire) : il peut voir la fiche.
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "lecteur" }));

    const result = await useCase.execute({ characterSheetId: "s-1", userId: "lecteur" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe("s-1");
    expect(result.value.name).toBe("Aragorn");
    expect(result.value.peupleId).toBe("peuple-1");
    expect(result.value.vigueur).toBe(6);
    expect(result.value.notes).toBeNull();
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche n'existe pas", async () => {
    const result = await useCase.execute({ characterSheetId: "ghost", userId: "owner-1" });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("échoue avec NOT_GROUP_MEMBER si le demandeur n'est pas membre du groupe de la fiche", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({ characterSheetId: "s-1", userId: "etranger" });

    expect(result.error).toBeInstanceOf(NotGroupMemberError);
  });

  describe("résolution de la formation et du peuple", () => {
    beforeEach(() => {
      txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "owner-1" }));
    });

    it("résout la formation (nom + bonus) et ses compétences liées", async () => {
      // Catalogue : une formation avec bonus, deux compétences liées + une compétence non liée.
      txRepos.formations.seed(
        buildTestReferenceItem("form-1", "group-1", "Guerrier", { stat: "vigueur", amount: 2 }),
      );
      txRepos.competences.seed(buildTestReferenceItem("comp-1", "group-1", "Épée"));
      txRepos.competences.seed(buildTestReferenceItem("comp-2", "group-1", "Bouclier"));
      txRepos.competences.seed(buildTestReferenceItem("comp-3", "group-1", "Magie"));
      await txRepos.formationCompetences.link("form-1", "comp-1", new Date());
      await txRepos.formationCompetences.link("form-1", "comp-2", new Date());

      txRepos.characterSheets.seed(
        buildTestCharacterSheet("s-1", "owner-1", "Aragorn", { formationId: "form-1" }),
      );

      const result = await useCase.execute({ characterSheetId: "s-1", userId: "owner-1" });

      expect(result.isSuccess).toBe(true);
      expect(result.value.formationId).toBe("form-1"); // l'id brut reste présent (rétrocompat)
      expect(result.value.formation).toEqual({
        id: "form-1",
        name: "Guerrier",
        stat: "vigueur",
        bonus: 2,
        competences: [
          { id: "comp-1", name: "Épée" },
          { id: "comp-2", name: "Bouclier" },
        ],
      });
    });

    it("résout le peuple (nom + bonus), sans compétences", async () => {
      txRepos.peoples.seed(
        buildTestReferenceItem("peuple-1", "group-1", "Elfe", { stat: "dexterite", amount: 1 }),
      );
      txRepos.characterSheets.seed(
        buildTestCharacterSheet("s-1", "owner-1", "Legolas", { peupleId: "peuple-1" }),
      );

      const result = await useCase.execute({ characterSheetId: "s-1", userId: "owner-1" });

      expect(result.isSuccess).toBe(true);
      expect(result.value.peuple).toEqual({
        id: "peuple-1",
        name: "Elfe",
        stat: "dexterite",
        bonus: 1,
      });
    });

    it("expose stat/bonus à null pour une formation sans bonus et un tableau de compétences vide", async () => {
      txRepos.formations.seed(buildTestReferenceItem("form-1", "group-1", "Roturier"));
      txRepos.characterSheets.seed(
        buildTestCharacterSheet("s-1", "owner-1", "Bilbo", { formationId: "form-1" }),
      );

      const result = await useCase.execute({ characterSheetId: "s-1", userId: "owner-1" });

      expect(result.value.formation).toEqual({
        id: "form-1",
        name: "Roturier",
        stat: null,
        bonus: null,
        competences: [],
      });
    });

    it("renvoie formation=null et peuple=null si la fiche ne porte pas ces ids", async () => {
      txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1", "Anonyme"));

      const result = await useCase.execute({ characterSheetId: "s-1", userId: "owner-1" });

      expect(result.isSuccess).toBe(true);
      expect(result.value.formation).toBeNull();
      expect(result.value.peuple).toBeNull();
    });

    it("renvoie formation=null si la formation portée appartient à un autre groupe (défense en profondeur)", async () => {
      // La formation existe mais dans « group-other », alors que la fiche est dans « group-1 ».
      txRepos.formations.seed(
        buildTestReferenceItem("form-1", "group-other", "Guerrier secret", {
          stat: "vigueur",
          amount: 9,
        }),
      );
      txRepos.characterSheets.seed(
        buildTestCharacterSheet("s-1", "owner-1", "Aragorn", { formationId: "form-1" }, "group-1"),
      );

      const result = await useCase.execute({ characterSheetId: "s-1", userId: "owner-1" });

      expect(result.isSuccess).toBe(true);
      // L'id brut reste exposé, mais le bloc résolu (nom/bonus/compétences du groupe tiers) est masqué.
      expect(result.value.formationId).toBe("form-1");
      expect(result.value.formation).toBeNull();
    });

    it("renvoie peuple=null si le peuple porté appartient à un autre groupe (défense en profondeur)", async () => {
      txRepos.peoples.seed(
        buildTestReferenceItem("peuple-1", "group-other", "Elfe secret", {
          stat: "dexterite",
          amount: 9,
        }),
      );
      txRepos.characterSheets.seed(
        buildTestCharacterSheet("s-1", "owner-1", "Legolas", { peupleId: "peuple-1" }, "group-1"),
      );

      const result = await useCase.execute({ characterSheetId: "s-1", userId: "owner-1" });

      expect(result.isSuccess).toBe(true);
      expect(result.value.peupleId).toBe("peuple-1");
      expect(result.value.peuple).toBeNull();
    });
  });
});
