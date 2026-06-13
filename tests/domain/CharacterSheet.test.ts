import { describe, it, expect } from "vitest";
import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";

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

  it("restore reconstruit fidèlement (round-trip)", () => {
    const snapshot = {
      id: "sheet-9",
      ownerId: "owner-9",
      name: CharacterSheetName.create("Legolas"),
      createdAt: new Date("2026-02-03T10:00:00Z"),
    };
    const sheet = CharacterSheet.restore(snapshot);
    expect(sheet.id).toBe("sheet-9");
    expect(sheet.ownerId).toBe("owner-9");
    expect(sheet.name.value).toBe("Legolas");
    expect(sheet.createdAt.getTime()).toBe(snapshot.createdAt.getTime());
  });
});
