import { describe, it, expect } from "vitest";
import { PdfKitCharacterSheetPdfGenerator } from "@infrastructure/pdf/PdfKitCharacterSheetPdfGenerator";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { CharacterSheetPdfReferences } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfReferences";

function detail(overrides: Partial<CharacterSheetDetail> = {}): CharacterSheetDetail {
  return {
    id: "s-1",
    ownerId: "u-1",
    name: "Aragorn",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    formationId: null,
    niveau: null,
    peupleId: null,
    sexe: null,
    tailleEtPoids: null,
    age: null,
    apparence: null,
    dexterite: null,
    intelligence: null,
    perception: null,
    social: null,
    vigueur: null,
    pointsDeVie: null,
    pointsDeMagie: null,
    protection: null,
    purse: null,
    sortsEtMiracles: null,
    notes: null,
    formation: null,
    peuple: null,
    ...overrides,
  };
}

function references(
  overrides: Partial<CharacterSheetPdfReferences> = {},
): CharacterSheetPdfReferences {
  return {
    formationName: null,
    peupleName: null,
    armes: [],
    armures: [],
    competences: [],
    equipements: [],
    statBonuses: [],
    ...overrides,
  };
}

describe("PdfKitCharacterSheetPdfGenerator (générateur réel)", () => {
  it("produit un Buffer PDF non vide débutant par les octets magiques %PDF", async () => {
    const pdf = await new PdfKitCharacterSheetPdfGenerator().generate(
      detail({ peupleId: "peuple-1", vigueur: 6, purse: { gold: 1, silver: 50, copper: 0 } }),
      references({ peupleName: "Elfe", armes: ["Épée longue"] }),
    );
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
