import { describe, it, expect } from "vitest";
import { buildCharacterSheetPdfReferences } from "@application/features/character-sheet/usecases/buildCharacterSheetPdfReferences";
import { buildTestReferenceItem } from "./fakes";

describe("buildCharacterSheetPdfReferences", () => {
  it("expose les noms résolus, les listes mappées et les bonus agrégés (formation + peuple)", () => {
    const refs = buildCharacterSheetPdfReferences(
      {
        formation: {
          id: "form-1",
          name: "Guerrier",
          stat: "social",
          bonus: 2,
          competences: [],
        },
        peuple: { id: "peuple-1", name: "Elfe", stat: "social", bonus: 1 },
      },
      {
        armes: [
          buildTestReferenceItem("a-1", "group-1", "Épée"),
          buildTestReferenceItem("a-2", "group-1", "Dague"),
        ],
        armures: [buildTestReferenceItem("ar-1", "group-1", "Cotte de mailles")],
        competences: [buildTestReferenceItem("c-1", "group-1", "Discrétion")],
        equipements: [buildTestReferenceItem("e-1", "group-1", "Torche")],
      },
    );

    expect(refs.formationName).toBe("Guerrier");
    expect(refs.peupleName).toBe("Elfe");
    expect(refs.armes).toEqual(["Épée", "Dague"]);
    expect(refs.armures).toEqual(["Cotte de mailles"]);
    expect(refs.competences).toEqual(["Discrétion"]);
    expect(refs.equipements).toEqual(["Torche"]);
    // Formation et peuple ciblent tous deux « social » → deux entrées distinctes (non fusionnées).
    expect(refs.statBonuses).toEqual([
      { stat: "social", amount: 2 },
      { stat: "social", amount: 1 },
    ]);
  });

  it("ignore les éléments sans stat dans statBonuses et applique le montant par défaut", () => {
    const refs = buildCharacterSheetPdfReferences(
      {
        formation: { id: "form-1", name: "Roturier", stat: null, bonus: null, competences: [] },
        peuple: { id: "peuple-1", name: "Nain", stat: "vigueur", bonus: null },
      },
      { armes: [], armures: [], competences: [], equipements: [] },
    );

    // Seul le peuple porte une stat ; son bonus null retombe sur le défaut (1).
    expect(refs.statBonuses).toEqual([{ stat: "vigueur", amount: 1 }]);
  });

  it("produit des champs vides/null et statBonuses [] quand tout est absent", () => {
    const refs = buildCharacterSheetPdfReferences(
      { formation: null, peuple: null },
      { armes: [], armures: [], competences: [], equipements: [] },
    );

    expect(refs).toEqual({
      formationName: null,
      peupleName: null,
      armes: [],
      armures: [],
      competences: [],
      equipements: [],
      statBonuses: [],
    });
  });
});
