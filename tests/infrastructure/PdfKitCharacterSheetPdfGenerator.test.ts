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

/**
 * Fiche entièrement renseignée avec des données **complètes et réalistes** : toutes les stats,
 * identité complète, et textes longs (~3 lignes) pour sorts et notes. Sert à prouver que la
 * page 1 (en-tête + caractéristiques/combat + inventaire) tient dans l'A4 et que la fiche fait
 * exactement deux pages.
 */
function fullDetail(): CharacterSheetDetail {
  return detail({
    name: "Aragorn fils d'Arathorn, héritier d'Isildur",
    niveau: 12,
    sexe: "Homme",
    tailleEtPoids: "1m98 / 95kg",
    age: 210,
    apparence: "Très grand, cheveux longs et noirs, regard gris perçant, barbe fournie",
    dexterite: 14,
    intelligence: 13,
    perception: 15,
    social: 12,
    vigueur: 16,
    pointsDeVie: 126,
    pointsDeMagie: 100,
    protection: 14,
    purse: { gold: 1234, silver: 5067, copper: 8912 },
    sortsEtMiracles:
      "Soin mineur (1d6 PV), Lumière (rayon 5m, 1h), Bénédiction (+1 au groupe), " +
      "Détection du mal (10m), Marche silencieuse (1 scène), Bouclier de foi (+2 protection " +
      "pendant un combat), Purification de l'eau et de la nourriture.",
    notes:
      "Héritier du trône du Gondor, élevé à Fondcombe par Elrond. Porte les fragments de " +
      "Narsil reforgés en Andúril. Allié des Rohirrim et membre de la Communauté de l'Anneau. " +
      "Recherché par les serviteurs de l'Ennemi à travers tout le Eriador.",
  });
}

/** Références entièrement renseignées : noms longs, listes pleines (3 armes, 2 armures, 4 compétences, 4 équipements) et bonus de stat. */
function fullReferences(): CharacterSheetPdfReferences {
  return references({
    formationName: "Rôdeur du Nord (Dúnedain)",
    peupleName: "Humain de race supérieure",
    armes: [
      "Épée longue Andúril, Flamme de l'Ouest",
      "Arc des Galadhrim",
      "Dague elfique de Fondcombe",
    ],
    armures: ["Cotte de mailles naine de la Moria", "Cape elfique de camouflage de la Lórien"],
    competences: [
      "Pistage expert",
      "Survie en milieu hostile",
      "Discrétion absolue",
      "Premiers soins avancés",
    ],
    equipements: [
      "Corde elfique de 30 mètres",
      "Rations de lembas pour deux semaines",
      "Pierre à feu",
      "Lanterne sourde",
    ],
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

  it("tient sur exactement deux pages avec des données complètes réalistes (page 1 ne déborde pas)", async () => {
    const pdf = await new PdfKitCharacterSheetPdfGenerator().generate(
      fullDetail(),
      fullReferences(),
    );
    expect(countPages(pdf)).toBe(2);
  });

  it("tient sur exactement deux pages même pour une fiche entièrement vide", async () => {
    const pdf = await new PdfKitCharacterSheetPdfGenerator().generate(detail(), references());
    expect(countPages(pdf)).toBe(2);
  });
});
