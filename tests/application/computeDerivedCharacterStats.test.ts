import { describe, it, expect } from "vitest";
import { computeDerivedCharacterStats } from "@application/features/character-sheet/usecases/computeDerivedCharacterStats";

describe("computeDerivedCharacterStats", () => {
  it("renvoie PV=10 et protection=0 quand vigueur est null et qu'il n'y a aucun bonus ni armure", () => {
    const result = computeDerivedCharacterStats({
      vigueur: null,
      formation: null,
      peuple: null,
      armures: [],
    });

    expect(result).toEqual({ pointsDeVie: 10, protection: 0 });
  });

  it("ajoute la vigueur de base et les bonus formation+peuple ciblant la vigueur (PV=16)", () => {
    const result = computeDerivedCharacterStats({
      vigueur: 3,
      formation: { stat: "vigueur", bonus: 2 },
      peuple: { stat: "vigueur", bonus: 1 },
      armures: [],
    });

    // 10 + (3 + 2 + 1) = 16
    expect(result.pointsDeVie).toBe(16);
  });

  it("ignore pour les PV un bonus ciblant une autre statistique (ex. social)", () => {
    const result = computeDerivedCharacterStats({
      vigueur: 3,
      formation: { stat: "social", bonus: 5 },
      peuple: { stat: "vigueur", bonus: 1 },
      armures: [],
    });

    // 10 + (3 + 0 [social ignoré] + 1) = 14
    expect(result.pointsDeVie).toBe(14);
  });

  it("traite un bonus null comme 0 même quand la stat ciblée est la vigueur", () => {
    const result = computeDerivedCharacterStats({
      vigueur: 4,
      formation: { stat: "vigueur", bonus: null },
      peuple: null,
      armures: [],
    });

    // 10 + (4 + 0) = 14
    expect(result.pointsDeVie).toBe(14);
  });

  it("somme les points de protection des armures, une armure sans valeur comptant 0", () => {
    const result = computeDerivedCharacterStats({
      vigueur: null,
      formation: null,
      peuple: null,
      armures: [{ protectionPoints: 2 }, { protectionPoints: 3 }, { protectionPoints: null }],
    });

    // 2 + 3 + 0 = 5
    expect(result.protection).toBe(5);
  });
});
