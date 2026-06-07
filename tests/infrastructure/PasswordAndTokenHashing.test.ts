import { describe, it, expect } from "vitest";
import { BcryptPasswordHasher } from "@infrastructure/security/BcryptPasswordHasher";
import { Sha256TokenHasher } from "@infrastructure/security/Sha256TokenHasher";

/**
 * Tests des adapters de hachage réels (bcrypt et SHA-256).
 *
 * Valident les propriétés cryptographiques attendues : bcrypt sale (empreintes
 * différentes pour la même entrée) et vérifie correctement ; SHA-256 est déterministe
 * (même entrée → même empreinte) et de longueur fixe (64 hex).
 */
describe("BcryptPasswordHasher (adapter réel)", () => {
  // Coût réduit pour des tests rapides ; la valeur de prod (12) est testée implicitement.
  const hasher = new BcryptPasswordHasher(4);

  it("hache puis valide un mot de passe correct", async () => {
    const hash = await hasher.hash("password123");
    expect(hash).not.toBe("password123");
    expect(await hasher.compare("password123", hash)).toBe(true);
  });

  it("rejette un mot de passe incorrect", async () => {
    const hash = await hasher.hash("password123");
    expect(await hasher.compare("wrong-password", hash)).toBe(false);
  });

  it("produit des empreintes différentes pour la même entrée (sel aléatoire)", async () => {
    const a = await hasher.hash("password123");
    const b = await hasher.hash("password123");
    expect(a).not.toBe(b);
  });
});

describe("Sha256TokenHasher (adapter réel)", () => {
  const hasher = new Sha256TokenHasher();

  it("est déterministe : même entrée → même empreinte", () => {
    expect(hasher.hash("token-abc")).toBe(hasher.hash("token-abc"));
  });

  it("produit des empreintes différentes pour des entrées différentes", () => {
    expect(hasher.hash("token-abc")).not.toBe(hasher.hash("token-xyz"));
  });

  it("produit une empreinte hexadécimale de 64 caractères (256 bits)", () => {
    const hash = hasher.hash("anything");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
