import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "mysql2/promise";

import { CharacterSheetDao } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";
import { CampaignCharacterDao } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CampaignCharacterDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

/**
 * Tests d'intégration des DAO fiches et liaison contre un MySQL réel (Testcontainers).
 *
 * Valide le SQL et le schéma migré (V005 : `character_sheets` + `campaign_characters`, FK,
 * PK composite anti-doublon, JOIN de lecture).
 */
describe("CharacterSheet / CampaignCharacter DAO (intégration MySQL)", () => {
  let pool: Pool;
  let sheetDao: CharacterSheetDao;
  let linkDao: CampaignCharacterDao;

  beforeAll(() => {
    pool = createTestPool();
    sheetDao = new CharacterSheetDao(pool);
    linkDao = new CampaignCharacterDao(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  /** Insère une campagne (avec son MJ) pour satisfaire les FK de la liaison. */
  async function insertCampaign(id: string, gameMasterId: string): Promise<void> {
    await pool.execute(
      "INSERT INTO campaigns (id, game_master_id, name, created_at) VALUES (?, ?, ?, ?)",
      [id, gameMasterId, "Campagne", new Date("2026-01-01T10:00:00Z")],
    );
  }

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "owner-1");
    await insertUser(pool, "mj-1");
  });

  it("insert + findByOwnerId + findById + deleteById sur character_sheets", async () => {
    const createdAt = new Date("2026-01-02T08:30:00Z");
    await sheetDao.insert({
      id: "s-1",
      owner_id: "owner-1",
      name: "Aragorn",
      created_at: createdAt,
    });

    const byOwner = await sheetDao.findByOwnerId("owner-1");
    expect(byOwner).toHaveLength(1);
    expect(byOwner[0]!.name).toBe("Aragorn");

    const byId = await sheetDao.findById("s-1");
    expect(byId).not.toBeNull();
    expect(byId!.created_at.getTime()).toBe(createdAt.getTime());

    await sheetDao.deleteById("s-1");
    expect(await sheetDao.findById("s-1")).toBeNull();
  });

  it("insert refuse un owner_id inexistant (FK)", async () => {
    await expect(
      sheetDao.insert({ id: "orphan", owner_id: "fantome", name: "X", created_at: new Date() }),
    ).rejects.toThrow();
  });

  it("link + existsByCampaignAndSheet + findSheetsByCampaignId + delete sur la liaison", async () => {
    await insertCampaign("camp-1", "mj-1");
    await sheetDao.insert({
      id: "s-1",
      owner_id: "owner-1",
      name: "Frodo",
      created_at: new Date("2026-01-02T08:00:00Z"),
    });

    await linkDao.insert({
      campaign_id: "camp-1",
      character_sheet_id: "s-1",
      created_at: new Date(),
    });
    expect(await linkDao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(true);

    const sheets = await linkDao.findSheetsByCampaignId("camp-1");
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.name).toBe("Frodo");

    await linkDao.delete("camp-1", "s-1");
    expect(await linkDao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(false);
  });

  it("la PK composite empêche les doublons de rattachement", async () => {
    await insertCampaign("camp-1", "mj-1");
    await sheetDao.insert({ id: "s-1", owner_id: "owner-1", name: "Sam", created_at: new Date() });
    await linkDao.insert({
      campaign_id: "camp-1",
      character_sheet_id: "s-1",
      created_at: new Date(),
    });

    await expect(
      linkDao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: new Date() }),
    ).rejects.toThrow();
  });

  it("supprimer une fiche retire ses liaisons (ON DELETE CASCADE)", async () => {
    await insertCampaign("camp-1", "mj-1");
    await sheetDao.insert({
      id: "s-1",
      owner_id: "owner-1",
      name: "Merry",
      created_at: new Date(),
    });
    await linkDao.insert({
      campaign_id: "camp-1",
      character_sheet_id: "s-1",
      created_at: new Date(),
    });

    await sheetDao.deleteById("s-1");

    expect(await linkDao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(false);
  });
});
