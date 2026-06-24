import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { SessionParticipantDao } from "@infrastructure/persistence/mysql/features/session/dao/SessionParticipantDao";
import { createTestPool, clearAllTables, insertUser, insertFriendGroup } from "./dbTestUtils";

describe("SessionParticipantDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: SessionParticipantDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new SessionParticipantDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "mj-1");
    await insertUser(pool, "p-2");
    await insertUser(pool, "p-3");
    await insertFriendGroup(pool, "grp-1", "mj-1");
    await pool.execute(
      "INSERT INTO campaigns (id, group_id, game_master_id, name, created_at) VALUES (?, ?, ?, ?, ?)",
      ["camp-1", "grp-1", "mj-1", "Campagne", new Date("2026-01-01T10:00:00Z")],
    );
    await pool.execute(
      "INSERT INTO sessions (id, campaign_id, title, date, created_at, status) VALUES (?, ?, ?, ?, ?, ?)",
      [
        "s-1",
        "camp-1",
        "Séance",
        new Date("2026-07-01T20:00:00Z"),
        new Date("2026-06-01T10:00:00Z"),
        "LOBBY",
      ],
    );
  });

  function invitation(userId: string) {
    return {
      session_id: "s-1",
      user_id: userId,
      character_sheet_id: null,
      status: "INVITED",
      invited_at: new Date("2026-06-24T10:00:00Z"),
      responded_at: null,
    };
  }

  it("insère un lot d'invitations et les relit par session", async () => {
    await dao.insertMany([invitation("p-2"), invitation("p-3")]);

    const rows = await dao.findBySessionId("s-1");
    expect(rows.map((r) => r.user_id).sort()).toEqual(["p-2", "p-3"]);
    expect(rows.every((r) => r.status === "INVITED")).toBe(true);
    expect(rows.every((r) => r.character_sheet_id === null)).toBe(true);
  });

  it("insertMany avec un lot vide est sans effet", async () => {
    await dao.insertMany([]);
    expect(await dao.findBySessionId("s-1")).toHaveLength(0);
  });

  it("rejette une participation rattachée à une session inexistante (FK)", async () => {
    await expect(
      dao.insertMany([{ ...invitation("p-2"), session_id: "fantome" }]),
    ).rejects.toThrow();
  });

  it("la suppression d'une session cascade sur ses participations", async () => {
    await dao.insertMany([invitation("p-2")]);
    await pool.execute("DELETE FROM sessions WHERE id = ?", ["s-1"]);
    expect(await dao.findBySessionId("s-1")).toHaveLength(0);
  });
});
