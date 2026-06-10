import { describe, it, expect } from "vitest";
import { PlainPassword } from "@domain/features/auth/value-objects/PlainPassword";
import { WeakPasswordError } from "@domain/features/auth/errors/WeakPasswordError";

describe("PlainPassword (value object)", () => {
  it("accepte un mot de passe respectant la politique (8–72 caractères)", () => {
    const password = PlainPassword.create("password123");
    expect(password.value).toBe("password123");
  });

  it("accepte exactement la longueur minimale et maximale", () => {
    // Les mots de passe doivent contenir au moins un chiffre ou caractère spécial.
    expect(() => PlainPassword.create("aaaaaaa1")).not.toThrow();
    expect(() => PlainPassword.create("a".repeat(71) + "1")).not.toThrow();
  });

  it("rejette un mot de passe trop court (< 8)", () => {
    expect(() => PlainPassword.create("short")).toThrow(WeakPasswordError);
  });

  it("rejette un mot de passe trop long (> 72)", () => {
    expect(() => PlainPassword.create("a".repeat(73))).toThrow(WeakPasswordError);
  });

  it.each([undefined, null, 42, {}])(
    "rejette une entrée non textuelle (%s) avec WeakPasswordError plutôt qu'un TypeError",
    (invalid) => {
      // Garde défensive : un corps de requête vide/malformé ne doit pas provoquer de 500.
      expect(() => PlainPassword.create(invalid as unknown as string)).toThrow(WeakPasswordError);
    },
  );
});
