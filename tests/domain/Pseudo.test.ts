import { describe, it, expect } from "vitest";
import { Pseudo } from "@domain/features/auth/value-objects/Pseudo";
import { InvalidPseudoError } from "@domain/features/auth/errors/InvalidPseudoError";

describe("Pseudo", () => {
  it("crée un pseudo valide et le normalise (trim)", () => {
    expect(Pseudo.create("  Gandalf  ").value).toBe("Gandalf");
  });
  it("rejette un pseudo vide", () => {
    expect(() => Pseudo.create("   ")).toThrow(InvalidPseudoError);
  });
  it("rejette un pseudo trop long (> 50)", () => {
    expect(() => Pseudo.create("a".repeat(51))).toThrow(InvalidPseudoError);
  });
  it("rejette une valeur non textuelle", () => {
    expect(() => Pseudo.create(undefined as unknown as string)).toThrow(InvalidPseudoError);
  });
});
