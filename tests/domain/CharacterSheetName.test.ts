import { describe, it, expect } from "vitest";
import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import { InvalidCharacterSheetNameError } from "@domain/features/character-sheet/errors/InvalidCharacterSheetNameError";

describe("CharacterSheetName (value object)", () => {
  it("accepte un nom valide et le normalise (trim)", () => {
    const name = CharacterSheetName.create("  Gandalf  ");
    expect(name.value).toBe("Gandalf");
  });

  it("considère deux noms identiques après normalisation comme égaux", () => {
    expect(CharacterSheetName.create("Frodo").equals(CharacterSheetName.create("  Frodo  "))).toBe(
      true,
    );
  });

  it.each(["", "   ", "\t\n"])("rejette un nom vide ou uniquement des espaces : %j", (invalid) => {
    expect(() => CharacterSheetName.create(invalid)).toThrow(InvalidCharacterSheetNameError);
  });

  it("rejette un nom trop long (> 120 caractères)", () => {
    expect(() => CharacterSheetName.create("a".repeat(121))).toThrow(
      InvalidCharacterSheetNameError,
    );
  });

  it.each([undefined, null, 42, {}])(
    "rejette une entrée non textuelle (%s) avec InvalidCharacterSheetNameError",
    (invalid) => {
      expect(() => CharacterSheetName.create(invalid as unknown as string)).toThrow(
        InvalidCharacterSheetNameError,
      );
    },
  );
});
