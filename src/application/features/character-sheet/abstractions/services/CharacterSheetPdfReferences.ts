/**
 * Données de référence **résolues** d'une fiche, prêtes à imprimer dans le PDF.
 *
 * La fiche ne porte que des **identifiants** (formation/peuple) et des **liaisons** (armes,
 * armures, compétences, équipement) : ce contrat plat fournit les **noms** déjà résolus (et la
 * liste des bonus de stat agrégés) pour que le générateur PDF n'ait aucune résolution à faire.
 *
 * Source **unique** du contrat de références PDF : le générateur (`PdfKitCharacterSheetPdfGenerator`)
 * consomme ce type tel quel pour son rendu, sans variante dupliquée.
 */
export interface CharacterSheetPdfReferences {
  /** Nom de la formation active, ou `null` si la fiche n'en porte pas (ou id orphelin/hors groupe). */
  readonly formationName: string | null;
  /** Nom du peuple actif, ou `null` (mêmes règles que {@link formationName}). */
  readonly peupleName: string | null;
  /** Noms des armes liées à la fiche (vide si aucune). */
  readonly armes: string[];
  /** Noms des armures liées à la fiche (vide si aucune). */
  readonly armures: string[];
  /** Noms des compétences liées à la fiche (vide si aucune). */
  readonly competences: string[];
  /** Noms des équipements liés à la fiche (vide si aucun). */
  readonly equipements: string[];
  /**
   * Bonus de statistique apportés par la formation et le peuple résolus (un par élément qui porte
   * une stat), pour affichage « +N sur <stat> ». Vide si ni la formation ni le peuple ne portent
   * de bonus.
   */
  readonly statBonuses: { stat: string; amount: number }[];
}
