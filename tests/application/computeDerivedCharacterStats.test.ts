import { describe, it, expect } from "vitest";
import { computeDerivedCharacterStats } from "@application/features/character-sheet/usecases/computeDerivedCharacterStats";

/** Bases neutres (toutes nulles) surchargées par cas, pour alléger les entrées de test. */
const NULL_BASES = {
  dexterite: null,
  intelligence: null,
  perception: null,
  social: null,
  vigueur: null,
} as const;

describe("computeDerivedCharacterStats", () => {
  it("renvoie PV=10 et protection=0 quand vigueur est null et qu'il n'y a aucun bonus ni armure", () => {
    const result = computeDerivedCharacterStats({
      ...NULL_BASES,
      formation: null,
      peuple: null,
      armures: [],
    });

    expect(result.pointsDeVie).toBe(10);
    expect(result.protection).toBe(0);
  });

  it("ajoute la vigueur de base et les bonus formation+peuple ciblant la vigueur (PV=16)", () => {
    const result = computeDerivedCharacterStats({
      ...NULL_BASES,
      vigueur: 3,
      formation: { stat: "vigueur", bonus: 2 },
      peuple: { stat: "vigueur", bonus: 1 },
      armures: [],
    });

    // 10 + (3 + 2 + 1) = 16, cohérent avec statTotals.vigueur = 6.
    expect(result.statTotals.vigueur).toBe(6);
    expect(result.pointsDeVie).toBe(16);
  });

  it("ignore pour les PV un bonus ciblant une autre statistique (ex. social)", () => {
    const result = computeDerivedCharacterStats({
      ...NULL_BASES,
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
      ...NULL_BASES,
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
      ...NULL_BASES,
      armures: [{ protectionPoints: 2 }, { protectionPoints: 3 }, { protectionPoints: null }],
      formation: null,
      peuple: null,
    });

    // 2 + 3 + 0 = 5
    expect(result.protection).toBe(5);
  });

  describe("statTotals (base + bonus formation + bonus peuple par caractéristique)", () => {
    it("renvoie un total égal à la base quand aucune source ne porte de bonus", () => {
      const result = computeDerivedCharacterStats({
        dexterite: 4,
        intelligence: 5,
        perception: 6,
        social: 3,
        vigueur: 2,
        formation: null,
        peuple: null,
        armures: [],
      });

      expect(result.statTotals).toEqual({
        dexterite: 4,
        intelligence: 5,
        perception: 6,
        social: 3,
        vigueur: 2,
      });
    });

    it("additionne base 3 + formation +2 (social) + peuple +1 (social) = 6 sur social", () => {
      const result = computeDerivedCharacterStats({
        ...NULL_BASES,
        social: 3,
        formation: { stat: "social", bonus: 2 },
        peuple: { stat: "social", bonus: 1 },
        armures: [],
      });

      expect(result.statTotals.social).toBe(6);
    });

    it("n'applique pas un bonus ciblant une autre stat à la stat courante", () => {
      const result = computeDerivedCharacterStats({
        ...NULL_BASES,
        dexterite: 4,
        social: 3,
        formation: { stat: "social", bonus: 2 },
        peuple: { stat: "vigueur", bonus: 5 },
        armures: [],
      });

      // dexterite n'est ciblée par aucun bonus ⇒ reste à sa base.
      expect(result.statTotals.dexterite).toBe(4);
      // social ne reçoit que le bonus formation (social), pas le bonus peuple (vigueur).
      expect(result.statTotals.social).toBe(5);
    });

    it("traite une base null comme 0 dans le total", () => {
      const result = computeDerivedCharacterStats({
        ...NULL_BASES,
        social: null,
        formation: { stat: "social", bonus: 2 },
        peuple: null,
        armures: [],
      });

      // 0 (base null) + 2 = 2
      expect(result.statTotals.social).toBe(2);
    });

    it("garde pointsDeVie cohérent avec statTotals.vigueur (PV = 10 + vigueur totale)", () => {
      const result = computeDerivedCharacterStats({
        ...NULL_BASES,
        vigueur: 5,
        formation: { stat: "vigueur", bonus: 3 },
        peuple: null,
        armures: [],
      });

      expect(result.statTotals.vigueur).toBe(8);
      expect(result.pointsDeVie).toBe(10 + result.statTotals.vigueur);
    });
  });
});
