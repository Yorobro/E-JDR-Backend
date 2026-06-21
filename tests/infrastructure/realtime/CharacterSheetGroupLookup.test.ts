import { describe, it, expect } from "vitest";
import { CharacterSheetGroupLookup } from "@infrastructure/realtime/CharacterSheetGroupLookup";

describe("CharacterSheetGroupLookup", () => {
  it("renvoie le groupId d'une fiche existante", async () => {
    const repo = { findById: async () => ({ groupId: "g-1" }) as never };
    const lookup = new CharacterSheetGroupLookup(repo);
    expect(await lookup.groupIdOf("s-1")).toBe("g-1");
  });

  it("renvoie null si la fiche n'existe pas", async () => {
    const repo = { findById: async () => null };
    const lookup = new CharacterSheetGroupLookup(repo);
    expect(await lookup.groupIdOf("absent")).toBeNull();
  });
});
