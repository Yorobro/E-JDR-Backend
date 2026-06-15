import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { CampaignCharacterDao } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CampaignCharacterDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

describe("CampaignCharacterDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: CampaignCharacterDao;
  const t = new Date("2026-01-01T10:00:00Z");

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new CampaignCharacterDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "mj-1", "MaitreDuJeu");
    await insertUser(pool, "owner-1");
    await pool.execute(
      "INSERT INTO campaigns (id, game_master_id, name, created_at) VALUES (?,?,?,?)",
      ["camp-1", "mj-1", "Donjon", t],
    );
    await pool.execute(
      "INSERT INTO character_sheets (id, owner_id, name, created_at) VALUES (?,?,?,?)",
      ["s-1", "owner-1", "Aragorn", t],
    );
  });

  it("insère un lien, le détecte, puis le supprime", async () => {
    expect(await dao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(false);
    await dao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: t });
    expect(await dao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(true);
    await dao.delete("camp-1", "s-1");
    expect(await dao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(false);
  });

  it("rejette un doublon (PK composite)", async () => {
    await dao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: t });
    await expect(
      dao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: t }),
    ).rejects.toThrow();
  });

  it("liste les fiches d'une campagne", async () => {
    await dao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: t });
    const sheets = await dao.findSheetsByCampaignId("camp-1");
    expect(sheets.map((s) => s.id)).toEqual(["s-1"]);
    expect(sheets[0]?.name).toBe("Aragorn");
  });

  it("liste les campagnes d'une fiche avec le pseudo du MJ", async () => {
    await dao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: t });
    const views = await dao.findCampaignViewsBySheetId("s-1");
    expect(views).toHaveLength(1);
    expect(views[0]?.campaign_id).toBe("camp-1");
    expect(views[0]?.campaign_name).toBe("Donjon");
    expect(views[0]?.game_master_pseudo).toBe("MaitreDuJeu");
  });
});
