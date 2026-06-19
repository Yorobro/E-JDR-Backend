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

/** Fiche entièrement renseignée (tous les champs + références non vides). */
function fullDetail(): CharacterSheetDetail {
  return detail({
    name: "Aragorn",
    niveau: 3,
    sexe: "Homme",
    tailleEtPoids: "1m85 / 80kg",
    age: 87,
    apparence: "Cheveux bruns, regard perçant",
    dexterite: 4,
    intelligence: 3,
    perception: 5,
    social: 2,
    vigueur: 6,
    pointsDeVie: 16,
    pointsDeMagie: 10,
    protection: 4,
    purse: { gold: 1, silver: 50, copper: 12 },
    sortsEtMiracles: "Soin mineur, Lumière, Bénédiction".repeat(5),
    notes: "Héritier du trône du Gondor. ".repeat(20),
  });
}

/** Références entièrement renseignées (noms + listes + bonus de stat). */
function fullReferences(): CharacterSheetPdfReferences {
  return references({
    formationName: "Rôdeur",
    peupleName: "Humain",
    armes: ["Épée longue", "Arc"],
    armures: ["Cotte de mailles"],
    competences: ["Pistage", "Survie", "Discrétion"],
    equipements: ["Corde", "Rations", "Pierre à feu"],
    statBonuses: [
      { stat: "vigueur", amount: 1 },
      { stat: "perception", amount: 2 },
    ],
  });
}

/** Compte les objets PDF `/Type /Page` (en excluant l'arbre `/Type /Pages`). */
function countPages(pdf: Buffer): number {
  const content = pdf.toString("latin1");
  const matches = content.match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

describe("PdfKitCharacterSheetPdfGenerator (générateur réel)", () => {
  it("produit un Buffer PDF non vide débutant par les octets magiques %PDF pour une fiche complète", async () => {
    const pdf = await new PdfKitCharacterSheetPdfGenerator().generate(
      fullDetail(),
      fullReferences(),
    );
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("ne jette pas et produit un PDF pour une fiche entièrement vide (tous les champs null)", async () => {
    const pdf = await new PdfKitCharacterSheetPdfGenerator().generate(detail(), references());
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("génère un document d'au moins deux pages", async () => {
    const pdf = await new PdfKitCharacterSheetPdfGenerator().generate(
      fullDetail(),
      fullReferences(),
    );
    expect(countPages(pdf)).toBeGreaterThanOrEqual(2);
  });
});
