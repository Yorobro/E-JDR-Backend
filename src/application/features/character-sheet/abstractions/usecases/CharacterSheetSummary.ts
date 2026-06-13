/**
 * Représentation publique (lecture) d'une fiche de personnage dans une liste.
 *
 * Partagée par les use cases de listing (mes fiches, fiches d'une campagne).
 */
export interface CharacterSheetSummary {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly createdAt: Date;
}
