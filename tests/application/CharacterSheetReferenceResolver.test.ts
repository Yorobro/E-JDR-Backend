import { describe, it, expect, beforeEach } from "vitest";
import { StatBonus } from "@domain/features/reference/value-objects/StatBonus";
import { CharacterSheetReferenceResolver } from "@application/features/character-sheet/usecases/CharacterSheetReferenceResolver";
import { buildFakeTransactionalRepositories, buildTestReferenceItem } from "./fakes";

describe("CharacterSheetReferenceResolver", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let resolver: CharacterSheetReferenceResolver;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    resolver = new CharacterSheetReferenceResolver({
      formationRepository: txRepos.formations,
      peupleRepository: txRepos.peoples,
      competenceRepository: txRepos.competences,
      formationCompetenceLink: txRepos.formationCompetences,
      peupleStatBonusLink: txRepos.peupleStatBonuses,
    });
  });

  it("renvoie formation=null et peuple=null si les ids sont null", async () => {
    const resolved = await resolver.resolve(null, null, "group-1");

    expect(resolved.formation).toBeNull();
    expect(resolved.peuple).toBeNull();
  });

  it("résout une formation (nom + bonus) avec ses deux compétences liées", async () => {
    txRepos.formations.seed(
      buildTestReferenceItem("form-1", "group-1", "Guerrier", { stat: "vigueur", amount: 2 }),
    );
    txRepos.competences.seed(buildTestReferenceItem("comp-1", "group-1", "Épée"));
    txRepos.competences.seed(buildTestReferenceItem("comp-2", "group-1", "Bouclier"));
    await txRepos.formationCompetences.link("form-1", "comp-1", new Date());
    await txRepos.formationCompetences.link("form-1", "comp-2", new Date());

    const resolved = await resolver.resolve("form-1", null, "group-1");

    expect(resolved.formation).toEqual({
      id: "form-1",
      name: "Guerrier",
      stat: "vigueur",
      bonus: 2,
      competences: [
        { id: "comp-1", name: "Épée" },
        { id: "comp-2", name: "Bouclier" },
      ],
    });
    expect(resolved.peuple).toBeNull();
  });

  it("résout le peuple avec PLUSIEURS bonus de statistique", async () => {
    txRepos.peoples.seed(buildTestReferenceItem("peuple-1", "group-1", "Elfe"));
    await txRepos.peupleStatBonuses.link(
      "peuple-1",
      StatBonus.create({ stat: "dexterite", amount: 1 }),
      new Date(),
    );
    await txRepos.peupleStatBonuses.link(
      "peuple-1",
      StatBonus.create({ stat: "perception", amount: 2 }),
      new Date(),
    );

    const resolved = await resolver.resolve(null, "peuple-1", "group-1");

    expect(resolved.peuple).toEqual({
      id: "peuple-1",
      name: "Elfe",
      statBonuses: [
        { stat: "dexterite", bonus: 1 },
        { stat: "perception", bonus: 2 },
      ],
    });
  });

  it("résout un peuple sans aucun bonus", async () => {
    txRepos.peoples.seed(buildTestReferenceItem("peuple-1", "group-1", "Humain"));

    const resolved = await resolver.resolve(null, "peuple-1", "group-1");

    expect(resolved.peuple).toEqual({ id: "peuple-1", name: "Humain", statBonuses: [] });
  });

  it("IGNORE la colonne historique stat/bonus du peuple (garde anti double comptage)", async () => {
    // Un peuple d'avant la migration : sa colonne `stat` est renseignée, mais la table de jointure
    // est vide (cas d'un backfill non joué, ou d'une ligne supprimée). Le bonus ne doit PAS
    // ressusciter depuis la colonne : elle a été recopiée dans la jointure, la relire compterait
    // chaque bonus deux fois dans les totaux de la fiche.
    txRepos.peoples.seed(
      buildTestReferenceItem("peuple-1", "group-1", "Nain", { stat: "vigueur", amount: 3 }),
    );

    const resolved = await resolver.resolve(null, "peuple-1", "group-1");

    expect(resolved.peuple).toEqual({ id: "peuple-1", name: "Nain", statBonuses: [] });
  });

  it("renvoie null si l'élément porté appartient à un autre groupe (défense en profondeur)", async () => {
    txRepos.formations.seed(
      buildTestReferenceItem("form-1", "group-other", "Guerrier secret", {
        stat: "vigueur",
        amount: 9,
      }),
    );
    txRepos.peoples.seed(
      buildTestReferenceItem("peuple-1", "group-other", "Elfe secret", {
        stat: "dexterite",
        amount: 9,
      }),
    );

    const resolved = await resolver.resolve("form-1", "peuple-1", "group-1");

    expect(resolved.formation).toBeNull();
    expect(resolved.peuple).toBeNull();
  });

  it("ignore les compétences orphelines (id lié mais élément introuvable)", async () => {
    txRepos.formations.seed(buildTestReferenceItem("form-1", "group-1", "Mage"));
    txRepos.competences.seed(buildTestReferenceItem("comp-1", "group-1", "Magie"));
    // « comp-orpheline » est liée à la formation mais n'existe pas dans le catalogue.
    await txRepos.formationCompetences.link("form-1", "comp-1", new Date());
    await txRepos.formationCompetences.link("form-1", "comp-orpheline", new Date());

    const resolved = await resolver.resolve("form-1", null, "group-1");

    expect(resolved.formation?.competences).toEqual([{ id: "comp-1", name: "Magie" }]);
  });
});
