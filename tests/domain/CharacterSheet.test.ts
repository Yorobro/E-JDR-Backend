import { describe, it, expect } from "vitest";
import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import { Sex } from "@domain/features/character-sheet/value-objects/Sex";
import { Purse } from "@domain/features/character-sheet/value-objects/Purse";

describe("CharacterSheet (entité)", () => {
  const build = (ownerId = "user-1"): CharacterSheet =>
    CharacterSheet.create({
      id: "sheet-1",
      ownerId,
      name: CharacterSheetName.create("Aragorn"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

  it("create établit le propriétaire", () => {
    expect(build("owner-42").ownerId).toBe("owner-42");
  });

  it("expose le nom sous forme de value object", () => {
    const sheet = build();
    expect(sheet.name).toBeInstanceOf(CharacterSheetName);
    expect(sheet.name.value).toBe("Aragorn");
  });

  it("isOwnedBy renvoie true pour le propriétaire, false sinon", () => {
    const sheet = build("owner-42");
    expect(sheet.isOwnedBy("owner-42")).toBe(true);
    expect(sheet.isOwnedBy("autre")).toBe(false);
  });

  it("create initialise les champs détaillés à null", () => {
    const sheet = build();
    expect(sheet.details.peupleId).toBeNull();
    expect(sheet.details.vigueur).toBeNull();
    expect(sheet.details.notes).toBeNull();
  });

  it("create accepte des champs détaillés optionnels", () => {
    const sheet = CharacterSheet.create({
      id: "sheet-1",
      ownerId: "user-1",
      name: CharacterSheetName.create("Aragorn"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      peupleId: "peuple-1",
      niveau: 5,
      age: 87,
      sexe: Sex.create("M"),
      vigueur: 6,
      purse: Purse.create({ gold: 2 }),
    });
    expect(sheet.details.peupleId).toBe("peuple-1");
    expect(sheet.details.niveau).toBe(5);
    expect(sheet.details.age).toBe(87);
    expect(sheet.details.sexe?.value).toBe("M");
    expect(sheet.details.vigueur).toBe(6);
    expect(sheet.details.purse?.gold).toBe(2);
    expect(sheet.details.formationId).toBeNull();
  });

  it("withDetails produit une nouvelle instance sans muter l'originale", () => {
    const original = build();
    const updated = original.withDetails({
      name: CharacterSheetName.create("Strider"),
      peupleId: "peuple-2",
      vigueur: 7,
    });

    // L'originale est inchangée (immutabilité).
    expect(original.name.value).toBe("Aragorn");
    expect(original.details.peupleId).toBeNull();

    // La nouvelle reflète les changements, identité technique préservée.
    expect(updated.id).toBe(original.id);
    expect(updated.ownerId).toBe(original.ownerId);
    expect(updated.createdAt.getTime()).toBe(original.createdAt.getTime());
    expect(updated.name.value).toBe("Strider");
    expect(updated.details.peupleId).toBe("peuple-2");
    expect(updated.details.vigueur).toBe(7);
  });

  it("restore reconstruit fidèlement (round-trip)", () => {
    const sheet = CharacterSheet.restore({
      ...build().details,
      id: "sheet-9",
      ownerId: "owner-9",
      name: CharacterSheetName.create("Legolas"),
      createdAt: new Date("2026-02-03T10:00:00Z"),
      perception: 8,
    });
    expect(sheet.id).toBe("sheet-9");
    expect(sheet.ownerId).toBe("owner-9");
    expect(sheet.name.value).toBe("Legolas");
    expect(sheet.createdAt.getTime()).toBe(new Date("2026-02-03T10:00:00Z").getTime());
    expect(sheet.details.perception).toBe(8);
  });
});
