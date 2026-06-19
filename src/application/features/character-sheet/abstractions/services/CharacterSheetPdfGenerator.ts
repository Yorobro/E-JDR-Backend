import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { CharacterSheetPdfReferences } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfReferences";

/**
 * Port « out » de génération du PDF d'une fiche de personnage.
 *
 * Abstrait la bibliothèque de rendu pour que la couche application reste indépendante de
 * l'infrastructure. L'implémentation produit le document **100 % en mémoire** (aucune écriture
 * disque) et ne résout qu'une fois le document finalisé.
 */
export interface CharacterSheetPdfGenerator {
  /**
   * Génère le PDF complet d'une fiche.
   * @param detail - La projection complète de la fiche à imprimer (stats, textes, ids bruts).
   * @param references - Les références **résolues** (noms formation/peuple, listes liées, bonus).
   * @returns Le PDF sous forme de `Buffer`.
   */
  generate(detail: CharacterSheetDetail, references: CharacterSheetPdfReferences): Promise<Buffer>;
}
