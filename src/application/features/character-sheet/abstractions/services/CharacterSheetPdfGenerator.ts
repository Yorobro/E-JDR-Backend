import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";

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
   * @param detail - La projection complète de la fiche à imprimer.
   * @returns Le PDF sous forme de `Buffer`.
   */
  generate(detail: CharacterSheetDetail): Promise<Buffer>;
}
