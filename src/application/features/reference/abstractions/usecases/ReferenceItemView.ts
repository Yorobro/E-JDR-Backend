/** Un bonus de statistique porté par un élément de référence : la stat ciblée et son montant. */
export interface StatBonusView {
  /** Statistique ciblée (`dexterite` | `intelligence` | `perception` | `social` | `vigueur`). */
  readonly stat: string;
  /** Montant ajouté à la statistique (entier ≥ 1). */
  readonly bonus: number;
}

/**
 * Représentation publique (lecture) d'un élément de référence, renvoyée par les use cases
 * catalogue (create/list) et par la lecture des liaisons d'une fiche.
 *
 * Le contrat des bonus de statistique est **asymétrique**, et c'est assumé :
 * - une **formation** porte au plus **un** bonus → {@link stat} + {@link bonus} ;
 * - un **peuple** porte **0..N** bonus (au plus un par stat) → {@link statBonuses}.
 */
export interface ReferenceItemView {
  /** Identifiant de l'élément. */
  readonly id: string;
  /** Nom (normalisé) de l'élément. */
  readonly name: string;
  /** Date de création de l'élément. */
  readonly createdAt: Date;
  /**
   * Statistique ciblée par le bonus (**formations uniquement**), ou `null` si la formation ne porte
   * pas de bonus. Toujours `null` pour tous les autres types — **y compris les peuples**, qui
   * exposent leurs bonus via {@link statBonuses}.
   */
  readonly stat: string | null;
  /** Montant du bonus de statistique (formations uniquement), ou `null` s'il n'y en a pas. */
  readonly bonus: number | null;
  /**
   * Bonus de statistique portés par l'élément (**peuples uniquement**), au plus un par stat.
   * Tableau vide pour tous les autres types, formations comprises.
   */
  readonly statBonuses: StatBonusView[];
  /**
   * Points de protection portés par l'élément (armures uniquement), ou `null` si l'élément n'en
   * porte pas (toujours `null` pour les formations, peuples, armes, compétences, équipements).
   */
  readonly protectionPoints: number | null;
  /**
   * Description libre portée par l'élément (sorts/miracles uniquement), ou `null` si l'élément n'en
   * porte pas (toujours `null` pour les formations, peuples, armes, armures, compétences, équipements).
   */
  readonly description: string | null;
  /**
   * Identifiants des compétences rattachées (formations uniquement). Tableau vide pour les autres
   * types.
   */
  readonly competenceIds: string[];
}
