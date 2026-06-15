import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { CampaignDao } from "@infrastructure/persistence/mysql/features/campaign/dao/CampaignDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

describe("CampaignDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: CampaignDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new CampaignDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "mj-1");
  });

  function row(id: string, name: string, createdAt: Date) {
    return { id, game_master_id: "mj-1", name, created_at: createdAt };
  }

  it("insère puis relit par id", async () => {
    await dao.insert(row("c-1", "Donjon", new Date("2026-01-01T10:00:00Z")));
    const found = await dao.findById("c-1");
    expect(found?.id).toBe("c-1");
    expect(found?.name).toBe("Donjon");
    expect(found?.created_at).toBeInstanceOf(Date);
  });

  it("liste les campagnes d'un MJ, plus récentes d'abord", async () => {
    await dao.insert(row("c-old", "Vieux", new Date("2026-01-01T10:00:00Z")));
    await dao.insert(row("c-new", "Neuf", new Date("2026-03-01T10:00:00Z")));
    const list = await dao.findByGameMasterId("mj-1");
    expect(list.map((c) => c.id)).toEqual(["c-new", "c-old"]);
  });

  it("retourne null si absente", async () => {
    expect(await dao.findById("absent")).toBeNull();
  });

  it("supprime par id", async () => {
    await dao.insert(row("c-1", "X", new Date("2026-01-01T10:00:00Z")));
    await dao.deleteById("c-1");
    expect(await dao.findById("c-1")).toBeNull();
  });

  it("rejette une campagne sans MJ existant (FK)", async () => {
    await expect(
      dao.insert({ id: "c-x", game_master_id: "fantome", name: "X", created_at: new Date() }),
    ).rejects.toThrow();
  });
});
