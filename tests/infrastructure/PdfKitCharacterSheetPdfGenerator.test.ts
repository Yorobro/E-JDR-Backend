import { describe, it, expect } from "vitest";
import { PdfKitCharacterSheetPdfGenerator } from "@infrastructure/pdf/PdfKitCharacterSheetPdfGenerator";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";

function detail(overrides: Partial<CharacterSheetDetail> = {}): CharacterSheetDetail {
  return {
    id: "s-1",
    ownerId: "u-1",
    name: "Aragorn",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    formation: null,
    niveau: null,
    peuple: null,
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
    competences: null,
    armes: null,
    armures: null,
    equipement: null,
    sortsEtMiracles: null,
    notes: null,
    ...overrides,
  };
}

describe("PdfKitCharacterSheetPdfGenerator (générateur réel)", () => {
  it("produit un Buffer PDF non vide débutant par les octets magiques %PDF", async () => {
    const pdf = await new PdfKitCharacterSheetPdfGenerator().generate(
      detail({ peuple: "Dúnedain", vigueur: 6, purse: { gold: 1, silver: 50, copper: 0 } }),
    );
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
