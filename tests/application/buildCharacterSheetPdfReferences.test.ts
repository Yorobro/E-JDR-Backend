import { describe, it, expect } from "vitest";
import { buildCharacterSheetPdfReferences } from "@application/features/character-sheet/usecases/buildCharacterSheetPdfReferences";
import { buildTestReferenceItem } from "./fakes";

describe("buildCharacterSheetPdfReferences", () => {
  it("expose les noms résolus et les listes mappées", () => {
    const refs = buildCharacterSheetPdfReferences(
      {
        formation: {
          id: "form-1",
          name: "Guerrier",
          stat: "social",
          bonus: 2,
          competences: [
            { id: "c-1", name: "Escrime" },
            { id: "c-2", name: "Esquive" },
          ],
        },
        peuple: { id: "peuple-1", name: "Elfe", stat: "social", bonus: 1 },
      },
      {
        armes: [
          buildTestReferenceItem("a-1", "group-1", "Épée"),
          buildTestReferenceItem("a-2", "group-1", "Dague"),
        ],
        armures: [buildTestReferenceItem("ar-1", "group-1", "Cotte de mailles")],
        equipements: [buildTestReferenceItem("e-1", "group-1", "Torche")],
        sorts: [buildTestReferenceItem("s-1", "group-1", "Boule de feu")],
        miracles: [buildTestReferenceItem("m-1", "group-1", "Guérison")],
      },
    );

    expect(refs.formationName).toBe("Guerrier");
    expect(refs.peupleName).toBe("Elfe");
    expect(refs.armes).toEqual(["Épée", "Dague"]);
    expect(refs.armures).toEqual(["Cotte de mailles"]);
    expect(refs.equipements).toEqual(["Torche"]);
    expect(refs.sorts).toEqual(["Boule de feu"]);
    expect(refs.miracles).toEqual(["Guérison"]);
  });

  it("imprime les compétences DÉRIVÉES DE LA FORMATION (et non une liaison de fiche)", () => {
    const refs = buildCharacterSheetPdfReferences(
      {
        formation: {
          id: "form-1",
          name: "Guerrier",
          stat: null,
          bonus: null,
          competences: [
            { id: "c-1", name: "Escrime" },
            { id: "c-2", name: "Esquive" },
            { id: "c-3", name: "Parade" },
          ],
        },
        peuple: null,
      },
      { armes: [], armures: [], equipements: [], sorts: [], miracles: [] },
    );

    expect(refs.competences).toEqual(["Escrime", "Esquive", "Parade"]);
  });

  it("renvoie des compétences vides si la formation n'en apporte aucune", () => {
    const refs = buildCharacterSheetPdfReferences(
      {
        formation: { id: "form-1", name: "Roturier", stat: null, bonus: null, competences: [] },
        peuple: null,
      },
      { armes: [], armures: [], equipements: [], sorts: [], miracles: [] },
    );

    expect(refs.competences).toEqual([]);
  });

  it("produit des champs vides/null quand tout est absent (fiche sans formation)", () => {
    const refs = buildCharacterSheetPdfReferences(
      { formation: null, peuple: null },
      { armes: [], armures: [], equipements: [], sorts: [], miracles: [] },
    );

    expect(refs).toEqual({
      formationName: null,
      peupleName: null,
      armes: [],
      armures: [],
      competences: [],
      equipements: [],
      sorts: [],
      miracles: [],
    });
  });
});
