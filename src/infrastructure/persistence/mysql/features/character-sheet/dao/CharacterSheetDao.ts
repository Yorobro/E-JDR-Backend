import { eq, and, desc } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { characterSheets, campaigns, users } from "@infrastructure/persistence/drizzle/schema";

/** Ligne complète `character_sheets` (type inféré : toutes colonnes). */
export type CharacterSheetRow = typeof characterSheets.$inferSelect;

/** Ligne brute de la campagne d'une fiche, enrichie du pseudo du MJ et du statut de rattachement. */
export interface SheetCampaignViewRow {
  campaign_id: string;
  campaign_name: string;
  game_master_pseudo: string;
  link_status: string;
}

/** Valeurs prêtes pour l'écriture d'une fiche complète (type d'insert Drizzle). */
export type CharacterSheetWriteRow = typeof characterSheets.$inferInsert;

/** DAO de la table `character_sheets` : query builder Drizzle. */
export class CharacterSheetDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(row: CharacterSheetWriteRow): Promise<void> {
    await this.executor.insert(characterSheets).values(row);
  }

  public async update(row: CharacterSheetWriteRow): Promise<void> {
    await this.executor
      .update(characterSheets)
      .set({
        name: row.name,
        formation_id: row.formation_id,
        niveau: row.niveau,
        peuple_id: row.peuple_id,
        sexe: row.sexe,
        taille_et_poids: row.taille_et_poids,
        age: row.age,
        apparence: row.apparence,
        dexterite: row.dexterite,
        intelligence: row.intelligence,
        perception: row.perception,
        social: row.social,
        vigueur: row.vigueur,
        points_de_vie: row.points_de_vie,
        points_de_magie: row.points_de_magie,
        protection: row.protection,
        purse_gold: row.purse_gold,
        purse_silver: row.purse_silver,
        purse_copper: row.purse_copper,
        notes: row.notes,
      })
      .where(eq(characterSheets.id, row.id));
  }

  public async findByOwnerId(ownerId: string): Promise<CharacterSheetRow[]> {
    return this.executor
      .select()
      .from(characterSheets)
      .where(eq(characterSheets.owner_id, ownerId))
      .orderBy(desc(characterSheets.created_at));
  }

  public async findByGroupId(groupId: string): Promise<CharacterSheetRow[]> {
    return this.executor
      .select()
      .from(characterSheets)
      .where(eq(characterSheets.group_id, groupId))
      .orderBy(desc(characterSheets.created_at));
  }

  public async findById(id: string): Promise<CharacterSheetRow | null> {
    const rows = await this.executor
      .select()
      .from(characterSheets)
      .where(eq(characterSheets.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    await this.executor.delete(characterSheets).where(eq(characterSheets.id, id));
  }

  /** Fiches rattachées à une campagne avec un statut donné (PENDING ou ACCEPTED). */
  public async findByCampaignIdAndStatus(
    campaignId: string,
    status: string,
  ): Promise<CharacterSheetRow[]> {
    return this.executor
      .select()
      .from(characterSheets)
      .where(
        and(
          eq(characterSheets.campaign_id, campaignId),
          eq(characterSheets.campaign_link_status, status),
        ),
      )
      .orderBy(desc(characterSheets.created_at));
  }

  /** Met à jour le seul statut de rattachement d'une fiche (validation MJ). */
  public async updateLinkStatus(id: string, status: string): Promise<void> {
    await this.executor
      .update(characterSheets)
      .set({ campaign_link_status: status })
      .where(eq(characterSheets.id, id));
  }

  /**
   * Vue de la campagne **unique** d'une fiche (id + nom + pseudo du MJ + statut), ou `null` si la
   * fiche n'existe pas. Projection cross-agrégat (character_sheets + campaigns + users).
   */
  public async findCampaignViewBySheetId(
    characterSheetId: string,
  ): Promise<SheetCampaignViewRow | null> {
    const rows = await this.executor
      .select({
        campaign_id: campaigns.id,
        campaign_name: campaigns.name,
        game_master_pseudo: users.pseudo,
        link_status: characterSheets.campaign_link_status,
      })
      .from(characterSheets)
      .innerJoin(campaigns, eq(campaigns.id, characterSheets.campaign_id))
      .innerJoin(users, eq(users.id, campaigns.game_master_id))
      .where(eq(characterSheets.id, characterSheetId))
      .limit(1);
    return rows[0] ?? null;
  }
}
