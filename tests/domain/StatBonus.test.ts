import { describe, it, expect } from "vitest";
import { StatBonus, ALLOWED_STATS } from "@domain/features/reference/value-objects/StatBonus";
import { InvalidStatBonusError } from "@domain/features/reference/errors/InvalidStatBonusError";

describe("StatBonus (value object)", () => {
  it("expose la liste des stats autorisées", () => {
    expect(ALLOWED_STATS).toEqual(["dexterite", "intelligence", "perception", "social", "vigueur"]);
  });

  it.each(ALLOWED_STATS)("accepte une stat valide (%s) avec un montant explicite", (stat) => {
    const bonus = StatBonus.create({ stat, amount: 3 });
    expect(bonus.stat).toBe(stat);
    expect(bonus.amount).toBe(3);
  });

  it("applique le montant par défaut de 1 si non fourni", () => {
    const bonus = StatBonus.create({ stat: "vigueur" });
    expect(bonus.amount).toBe(1);
  });

  it.each(["force", "chance", "", "Dexterite", "VIGUEUR"])(
    "rejette une stat hors liste (%j)",
    (invalid) => {
      expect(() => StatBonus.create({ stat: invalid as never })).toThrow(InvalidStatBonusError);
    },
  );

  it.each([undefined, null, 42, {}])("rejette une stat non textuelle (%s)", (invalid) => {
    expect(() => StatBonus.create({ stat: invalid as never })).toThrow(InvalidStatBonusError);
  });

  it.each([0, -1, -5])("rejette un montant < 1 (%i)", (amount) => {
    expect(() => StatBonus.create({ stat: "social", amount })).toThrow(InvalidStatBonusError);
  });

  it.each([1.5, 2.3])("rejette un montant non entier (%f)", (amount) => {
    expect(() => StatBonus.create({ stat: "social", amount })).toThrow(InvalidStatBonusError);
  });

  it("accepte un montant minimal de 1", () => {
    const bonus = StatBonus.create({ stat: "perception", amount: 1 });
    expect(bonus.amount).toBe(1);
  });
});
