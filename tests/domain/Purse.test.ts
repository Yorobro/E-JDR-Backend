import { describe, it, expect } from "vitest";
import { Purse } from "@domain/features/character-sheet/value-objects/Purse";
import { InvalidPurseError } from "@domain/features/character-sheet/errors/InvalidPurseError";

describe("Purse (value object)", () => {
  it("crée une bourse valide et expose ses pièces", () => {
    const p = Purse.create({ gold: 1, silver: 50, copper: 30 });
    expect(p.gold).toBe(1);
    expect(p.silver).toBe(50);
    expect(p.copper).toBe(30);
  });

  it("traite les valeurs absentes comme 0", () => {
    const p = Purse.create({});
    expect(p.gold).toBe(0);
    expect(p.silver).toBe(0);
    expect(p.copper).toBe(0);
  });

  it("totalInCopper applique 1 gold = 100 silver = 10000 copper", () => {
    expect(Purse.create({ gold: 1 }).totalInCopper()).toBe(10000);
    expect(Purse.create({ silver: 1 }).totalInCopper()).toBe(100);
    expect(Purse.create({ gold: 1, silver: 50, copper: 30 }).totalInCopper()).toBe(15030);
  });

  it("normalized recombine en forme canonique", () => {
    const n = Purse.create({ gold: 0, silver: 150, copper: 0 }).normalized();
    expect(n.gold).toBe(1);
    expect(n.silver).toBe(50);
    expect(n.copper).toBe(0);
  });

  it("rejette un entier négatif", () => {
    expect(() => Purse.create({ gold: -1 })).toThrow(InvalidPurseError);
  });

  it("rejette une valeur non entière", () => {
    expect(() => Purse.create({ silver: 1.5 })).toThrow(InvalidPurseError);
  });
});
