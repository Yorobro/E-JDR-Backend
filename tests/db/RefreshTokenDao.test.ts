import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { RefreshTokenDao } from "@infrastructure/persistence/mysql/features/auth/dao/RefreshTokenDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

describe("RefreshTokenDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: RefreshTokenDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new RefreshTokenDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "u-1");
  });

  function row(id: string, tokenHash: string, expiresAt: Date) {
    return {
      id,
      user_id: "u-1",
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: new Date("2026-01-01T10:00:00Z"),
    };
  }

  it("insère puis relit par empreinte", async () => {
    await dao.insert(row("t-1", "h".repeat(64), new Date("2026-12-31T00:00:00Z")));
    const found = await dao.findByTokenHash("h".repeat(64));
    expect(found?.id).toBe("t-1");
  });

  it("supprime par empreinte", async () => {
    await dao.insert(row("t-1", "a".repeat(64), new Date("2026-12-31T00:00:00Z")));
    await dao.deleteByTokenHash("a".repeat(64));
    expect(await dao.findByTokenHash("a".repeat(64))).toBeNull();
  });

  it("supprime tous les tokens d'un utilisateur", async () => {
    await dao.insert(row("t-1", "b".repeat(64), new Date("2026-12-31T00:00:00Z")));
    await dao.insert(row("t-2", "c".repeat(64), new Date("2026-12-31T00:00:00Z")));
    await dao.deleteAllForUser("u-1");
    expect(await dao.findByTokenHash("b".repeat(64))).toBeNull();
    expect(await dao.findByTokenHash("c".repeat(64))).toBeNull();
  });

  it("purge uniquement les tokens expirés", async () => {
    await dao.insert(row("t-old", "d".repeat(64), new Date("2025-01-01T00:00:00Z")));
    await dao.insert(row("t-new", "e".repeat(64), new Date("2027-01-01T00:00:00Z")));
    await dao.deleteExpired(new Date("2026-06-15T00:00:00Z"));
    expect(await dao.findByTokenHash("d".repeat(64))).toBeNull();
    expect(await dao.findByTokenHash("e".repeat(64))).not.toBeNull();
  });
});
