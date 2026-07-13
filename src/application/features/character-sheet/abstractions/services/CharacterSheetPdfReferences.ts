/**
 * Données de référence **résolues** d'une fiche, prêtes à imprimer dans le PDF.
 *
 * La fiche ne porte que des **identifiants** (formation/peuple) et des **liaisons** (armes,
 * armures, équipement) : ce contrat plat fournit les **noms** déjà résolus pour que le générateur
 * PDF n'ait aucune résolution à faire.
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
  /**
   * Noms des compétences **apportées par la formation** (vide si la fiche n'a pas de formation, ou
   * si celle-ci n'apporte aucune compétence). Les compétences ne sont pas liées à la fiche : elles
   * sont intégralement dérivées de la formation.
   */
  readonly competences: string[];
  /** Noms des équipements liés à la fiche (vide si aucun). */
  readonly equipements: string[];
  /** Noms des sorts liés à la fiche (vide si aucun). */
  readonly sorts: string[];
  /** Noms des miracles liés à la fiche (vide si aucun). */
  readonly miracles: string[];
}
