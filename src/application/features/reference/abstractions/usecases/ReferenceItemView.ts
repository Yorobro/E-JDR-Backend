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
  /**
   * Statistique ciblée par le bonus (formations/peuples), ou `null` si l'élément ne porte pas de
   * bonus (toujours `null` pour les armes, armures, compétences, équipements).
   */
  readonly stat: string | null;
  /** Montant du bonus de statistique, ou `null` si l'élément ne porte pas de bonus. */
  readonly bonus: number | null;
  /**
   * Points de protection portés par l'élément (armures uniquement), ou `null` si l'élément n'en
   * porte pas (toujours `null` pour les formations, peuples, armes, compétences, équipements).
   */
  readonly protectionPoints: number | null;
  /**
   * Identifiants des compétences rattachées (formations uniquement). Tableau vide pour les autres
   * types.
   */
  readonly competenceIds: string[];
}
