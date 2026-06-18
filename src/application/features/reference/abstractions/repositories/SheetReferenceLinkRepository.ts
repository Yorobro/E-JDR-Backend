import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";

/**
 * Port « out » générique d'une **liaison N‑N fiche ↔ éléments de référence** (une table de
 * jointure : `sheet_armes`, `sheet_armures`, `sheet_competences`, `sheet_equipements`).
 *
 * Comme {@link ReferenceRepository}, chaque catégorie liable a son propre repository distingué
 * par un type marqueur, partageant ce contrat.
 */
export interface SheetReferenceLinkRepository {
  /**
   * Rattache un élément à une fiche.
   *
   * @param sheetId - Identifiant de la fiche.
   * @param itemId - Identifiant de l'élément de référence.
   * @param createdAt - Horodatage du rattachement.
   */
  link(sheetId: string, itemId: string, createdAt: Date): Promise<void>;

  /**
   * Détache un élément d'une fiche (idempotent).
   *
   * @param sheetId - Identifiant de la fiche.
   * @param itemId - Identifiant de l'élément de référence.
   */
  unlink(sheetId: string, itemId: string): Promise<void>;

  /**
   * Indique si l'élément est déjà rattaché à la fiche.
   *
   * @param sheetId - Identifiant de la fiche.
   * @param itemId - Identifiant de l'élément.
   * @returns `true` si la liaison existe déjà.
   */
  existsBySheetAndItem(sheetId: string, itemId: string): Promise<boolean>;

  /**
   * Liste les éléments rattachés à une fiche (du plus récemment rattaché au plus ancien).
   *
   * @param sheetId - Identifiant de la fiche.
   * @returns Les éléments rattachés (vide si aucun).
   */
  findItemsBySheet(sheetId: string): Promise<ReferenceItem[]>;
}

/** Liaison fiche ↔ **armes**. */
export type SheetArmeLinkRepository = SheetReferenceLinkRepository;
/** Liaison fiche ↔ **armures**. */
export type SheetArmureLinkRepository = SheetReferenceLinkRepository;
/** Liaison fiche ↔ **compétences**. */
export type SheetCompetenceLinkRepository = SheetReferenceLinkRepository;
/** Liaison fiche ↔ **équipements**. */
export type SheetEquipementLinkRepository = SheetReferenceLinkRepository;
