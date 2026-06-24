import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { SessionDao } from "@infrastructure/persistence/mysql/features/session/dao/SessionDao";
import { createTestPool, clearAllTables, insertUser, insertFriendGroup } from "./dbTestUtils";

describe("SessionDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: SessionDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new SessionDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "mj-1");
    await insertFriendGroup(pool, "grp-1", "mj-1");
    await pool.execute(
      "INSERT INTO campaigns (id, group_id, game_master_id, name, created_at) VALUES (?, ?, ?, ?, ?)",
      ["camp-1", "grp-1", "mj-1", "Campagne", new Date("2026-01-01T10:00:00Z")],
    );
  });

  function row() {
    return {
      id: "s-1",
      campaign_id: "camp-1",
      title: "Séance",
      date: new Date("2026-07-01T20:00:00Z"),
      created_at: new Date("2026-06-01T10:00:00Z"),
    };
  }

  it("insère une session au statut PLANNED par défaut (sans started_at)", async () => {
    await dao.insert(row());
    const found = await dao.findById("s-1");
    expect(found?.status).toBe("PLANNED");
    expect(found?.started_at).toBeNull();
  });

  it("update persiste le nouveau statut et la date de démarrage", async () => {
    await dao.insert(row());
    const startedAt = new Date("2026-07-01T20:05:00Z");
    await dao.update({
      id: "s-1",
      title: "Séance",
      date: new Date("2026-07-01T20:00:00Z"),
      status: "ACTIVE",
      started_at: startedAt,
    });

    const found = await dao.findById("s-1");
    expect(found?.status).toBe("ACTIVE");
    expect(found?.started_at).toBeInstanceOf(Date);
  });

  it("update vers LOBBY laisse started_at à null", async () => {
    await dao.insert(row());
    await dao.update({
      id: "s-1",
      title: "Séance",
      date: new Date("2026-07-01T20:00:00Z"),
      status: "LOBBY",
      started_at: null,
    });

    const found = await dao.findById("s-1");
    expect(found?.status).toBe("LOBBY");
    expect(found?.started_at).toBeNull();
  });

  it("rejette une session sans campagne existante (FK)", async () => {
    await expect(
      dao.insert({
        id: "s-x",
        campaign_id: "fantome",
        title: "X",
        date: new Date(),
        created_at: new Date(),
      }),
    ).rejects.toThrow();
  });
});
