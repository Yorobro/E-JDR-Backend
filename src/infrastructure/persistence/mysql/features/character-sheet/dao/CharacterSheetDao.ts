import { RowDataPacket } from "mysql2/promise";
import { SqlExecutor } from "@infrastructure/persistence/mysql/SqlExecutor";

/**
 * Représentation **brute** d'une ligne de la table `character_sheets`, telle que renvoyée
 * par MySQL. Le mapping vers l'entité domaine est effectué par le `CharacterSheetMapper`.
 *
 * Les colonnes détaillées sont optionnelles côté type : les requêtes de **liste** (projection
 * nom seul) ne les sélectionnent pas, le mapper traite alors leur absence comme `null`.
 */
export interface CharacterSheetRow extends RowDataPacket {
  id: string;
  owner_id: string;
  name: string;
  created_at: Date;
  // Identité (texte court, niveau/âge entiers)
  formation?: string | null;
  niveau?: number | null;
  peuple?: string | null;
  sexe?: string | null;
  taille_et_poids?: string | null;
  age?: number | null;
  apparence?: string | null;
  // Caractéristiques (entiers)
  dexterite?: number | null;
  intelligence?: number | null;
  perception?: number | null;
  social?: number | null;
  vigueur?: number | null;
  // Ressources de combat (entiers)
  points_de_vie?: number | null;
  points_de_magie?: number | null;
  protection?: number | null;
  // Bourse (pièces brutes)
  purse_gold?: number | null;
  purse_silver?: number | null;
  purse_copper?: number | null;
  // Zones de texte long
  competences?: string | null;
  armes?: string | null;
  armures?: string | null;
  equipement?: string | null;
  sorts_et_miracles?: string | null;
  notes?: string | null;
}

/** Valeurs de colonnes prêtes pour l'écriture (insert/update) d'une fiche complète. */
export interface CharacterSheetWriteRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: Date;
  formation: string | null;
  niveau: number | null;
  peuple: string | null;
  sexe: string | null;
  taille_et_poids: string | null;
  age: number | null;
  apparence: string | null;
  dexterite: number | null;
  intelligence: number | null;
  perception: number | null;
  social: number | null;
  vigueur: number | null;
  points_de_vie: number | null;
  points_de_magie: number | null;
  protection: number | null;
  purse_gold: number | null;
  purse_silver: number | null;
  purse_copper: number | null;
  competences: string | null;
  armes: string | null;
  armures: string | null;
  equipement: string | null;
  sorts_et_miracles: string | null;
  notes: string | null;
}

/** Colonnes détaillées (hors clés techniques), dans l'ordre stable insert/update/select. */
const DETAIL_COLUMNS = [
  "formation",
  "niveau",
  "peuple",
  "sexe",
  "taille_et_poids",
  "age",
  "apparence",
  "dexterite",
  "intelligence",
  "perception",
  "social",
  "vigueur",
  "points_de_vie",
  "points_de_magie",
  "protection",
  "purse_gold",
  "purse_silver",
  "purse_copper",
  "armures",
  "armes",
  "competences",
  "equipement",
  "sorts_et_miracles",
  "notes",
] as const;

/** Toutes les colonnes d'une fiche complète, clés techniques en tête. */
const ALL_COLUMNS = ["id", "owner_id", "name", "created_at", ...DETAIL_COLUMNS] as const;

/** Type d'une valeur de colonne (paramètre lié SQL) pour une fiche. */
type CellValue = string | number | Date | null;

/** Extrait du `row` les valeurs des colonnes, dans l'ordre de `columns`. */
function valuesOf(row: CharacterSheetWriteRow, columns: readonly string[]): CellValue[] {
  return columns.map((column) => row[column as keyof CharacterSheetWriteRow]);
}

/**
 * DAO de la table `character_sheets` : **SQL pur**, une seule table, renvoie des lignes brutes.
 */
export class CharacterSheetDao {
  constructor(private readonly executor: SqlExecutor) {}

  /**
   * Insère une nouvelle ligne complète dans la table `character_sheets`.
   *
   * @param row - Les valeurs de toutes les colonnes à insérer.
   */
  public async insert(row: CharacterSheetWriteRow): Promise<void> {
    const placeholders = ALL_COLUMNS.map(() => "?").join(", ");
    await this.executor.execute(
      `INSERT INTO character_sheets (${ALL_COLUMNS.join(", ")}) VALUES (${placeholders})`,
      valuesOf(row, ALL_COLUMNS),
    );
  }

  /**
   * Met à jour le nom et les champs détaillés d'une fiche existante. Ne touche ni `owner_id`
   * ni `created_at`.
   *
   * @param row - Les nouvelles valeurs (la ligne complète ; seules name + colonnes détaillées
   *   sont écrites).
   */
  public async update(row: CharacterSheetWriteRow): Promise<void> {
    const editable = ["name", ...DETAIL_COLUMNS] as const;
    const assignments = editable.map((column) => `${column} = ?`).join(", ");
    await this.executor.execute(`UPDATE character_sheets SET ${assignments} WHERE id = ?`, [
      ...valuesOf(row, editable),
      row.id,
    ]);
  }

  /**
   * Récupère toutes les fiches d'un propriétaire (projection nom seul), des plus récentes aux
   * plus anciennes.
   *
   * @param ownerId - L'identifiant du propriétaire.
   * @returns Les lignes correspondantes (tableau éventuellement vide).
   */
  public async findByOwnerId(ownerId: string): Promise<CharacterSheetRow[]> {
    const [rows] = await this.executor.execute<CharacterSheetRow[]>(
      "SELECT id, owner_id, name, created_at FROM character_sheets WHERE owner_id = ? ORDER BY created_at DESC",
      [ownerId],
    );
    return rows;
  }

  /**
   * Récupère une ligne `character_sheets` **complète** par son identifiant.
   *
   * @param id - L'identifiant recherché.
   * @returns La ligne correspondante (toutes colonnes), ou `null` si aucune.
   */
  public async findById(id: string): Promise<CharacterSheetRow | null> {
    const [rows] = await this.executor.execute<CharacterSheetRow[]>(
      `SELECT ${ALL_COLUMNS.join(", ")} FROM character_sheets WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  /**
   * Supprime une ligne `character_sheets` par son identifiant.
   *
   * @param id - L'identifiant de la ligne à supprimer.
   */
  public async deleteById(id: string): Promise<void> {
    await this.executor.execute("DELETE FROM character_sheets WHERE id = ?", [id]);
  }

  /**
   * Récupère les fiches rattachables à une campagne (projection nom seul) : propriétaire ≠ MJ,
   * hors fiches déjà liées à cette campagne. Triées des plus récentes aux plus anciennes.
   *
   * @param gameMasterId - L'identifiant du MJ (ses fiches sont exclues).
   * @param campaignId - L'identifiant de la campagne (les fiches déjà liées sont exclues).
   * @returns Les lignes correspondantes (tableau éventuellement vide).
   */
  public async findLinkableForCampaign(
    gameMasterId: string,
    campaignId: string,
  ): Promise<CharacterSheetRow[]> {
    const [rows] = await this.executor.execute<CharacterSheetRow[]>(
      `SELECT cs.id, cs.owner_id, cs.name, cs.created_at
         FROM character_sheets cs
        WHERE cs.owner_id <> ?
          AND NOT EXISTS (
            SELECT 1 FROM campaign_characters cc
             WHERE cc.character_sheet_id = cs.id AND cc.campaign_id = ?
          )
        ORDER BY cs.created_at DESC`,
      [gameMasterId, campaignId],
    );
    return rows;
  }
}
