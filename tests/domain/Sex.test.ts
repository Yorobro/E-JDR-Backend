import { describe, it, expect } from "vitest";
import { Sex } from "@domain/features/character-sheet/value-objects/Sex";
import { InvalidSexError } from "@domain/features/character-sheet/errors/InvalidSexError";

describe("Sex (value object)", () => {
  it("accepte M, F, NB", () => {
    expect(Sex.create("M").value).toBe("M");
    expect(Sex.create("F").value).toBe("F");
    expect(Sex.create("NB").value).toBe("NB");
  });

  it("normalise la casse et les espaces", () => {
    expect(Sex.create(" m ").value).toBe("M");
    expect(Sex.create("nb").value).toBe("NB");
  });

  it("rejette une valeur hors M/F/NB", () => {
    expect(() => Sex.create("X")).toThrow(InvalidSexError);
  });
});
