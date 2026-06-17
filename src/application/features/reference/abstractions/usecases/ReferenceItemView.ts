/**
 * Représentation publique (lecture) d'un élément de référence, renvoyée par les use cases
 * catalogue (create/list) et par la lecture des liaisons d'une fiche.
 */
export interface ReferenceItemView {
  /** Identifiant de l'élément. */
  readonly id: string;
  /** Nom (normalisé) de l'élément. */
  readonly name: string;
  /** Date de création de l'élément. */
  readonly createdAt: Date;
}
