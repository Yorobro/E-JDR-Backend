import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { CredentialDao } from "@infrastructure/persistence/mysql/features/auth/dao/CredentialDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

describe("CredentialDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: CredentialDao;
  const createdAt = new Date("2026-01-01T10:00:00Z");

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new CredentialDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "u-1");
  });

  function baseRow() {
    return {
      id: "c-1",
      user_id: "u-1",
      email: "a@b.c",
      password_hash: "hash",
      created_at: createdAt,
      failed_attempts: 0,
      locked_until: null,
    };
  }

  it("insère puis relit par email et par user_id", async () => {
    await dao.insert(baseRow());

    const byEmail = await dao.findByEmail("a@b.c");
    expect(byEmail?.id).toBe("c-1");
    expect(byEmail?.failed_attempts).toBe(0);
    expect(byEmail?.locked_until).toBeNull();

    const byUser = await dao.findByUserId("u-1");
    expect(byUser?.id).toBe("c-1");
  });

  it("existsByEmail reflète la présence", async () => {
    expect(await dao.existsByEmail("a@b.c")).toBe(false);
    await dao.insert(baseRow());
    expect(await dao.existsByEmail("a@b.c")).toBe(true);
  });

  it("met à jour le verrouillage", async () => {
    await dao.insert(baseRow());
    const lockedUntil = new Date("2026-02-01T00:00:00Z");
    await dao.update("c-1", { failed_attempts: 3, locked_until: lockedUntil });

    const row = await dao.findByEmail("a@b.c");
    expect(row?.failed_attempts).toBe(3);
    expect(row?.locked_until).toBeInstanceOf(Date);
  });

  it("rejette un credential sans user existant (FK)", async () => {
    await expect(dao.insert({ ...baseRow(), id: "c-2", user_id: "fantome" })).rejects.toThrow();
  });
});
