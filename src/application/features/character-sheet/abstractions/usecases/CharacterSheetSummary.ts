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
  /** Campagne à laquelle la fiche est rattachée (modèle « une fiche = une campagne »). */
  readonly campaignId: string;
  /** Nom de cette campagne (joint depuis le catalogue de campagnes du groupe). */
  readonly campaignName: string;
  /** Statut du rattachement : `"PENDING"` ou `"ACCEPTED"`. */
  readonly linkStatus: string;
}
