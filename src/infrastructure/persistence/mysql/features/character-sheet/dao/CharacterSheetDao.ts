import { eq, and, desc, ne, notExists } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { characterSheets, campaignCharacters } from "@infrastructure/persistence/drizzle/schema";

/** Ligne complète `character_sheets` (type inféré : toutes colonnes). */
export type CharacterSheetRow = typeof characterSheets.$inferSelect;

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
        sorts_et_miracles: row.sorts_et_miracles,
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

  public async findLinkableForCampaign(
    groupId: string,
    gameMasterId: string,
    campaignId: string,
  ): Promise<CharacterSheetRow[]> {
    return this.executor
      .select()
      .from(characterSheets)
      .where(
        and(
          eq(characterSheets.group_id, groupId),
          ne(characterSheets.owner_id, gameMasterId),
          notExists(
            this.executor
              .select({ one: campaignCharacters.campaign_id })
              .from(campaignCharacters)
              .where(
                and(
                  eq(campaignCharacters.character_sheet_id, characterSheets.id),
                  eq(campaignCharacters.campaign_id, campaignId),
                ),
              ),
          ),
        ),
      )
      .orderBy(desc(characterSheets.created_at));
  }
}
