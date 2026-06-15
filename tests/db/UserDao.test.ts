import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { UserDao } from "@infrastructure/persistence/mysql/features/auth/dao/UserDao";
import { createTestPool, clearAllTables } from "./dbTestUtils";

describe("UserDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: UserDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new UserDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
  });

  it("insère puis relit un utilisateur par id", async () => {
    const createdAt = new Date("2026-01-01T10:00:00Z");
    await dao.insert({ id: "u-1", pseudo: "Gandalf", created_at: createdAt });

    const row = await dao.findById("u-1");
    expect(row).not.toBeNull();
    expect(row?.id).toBe("u-1");
    expect(row?.pseudo).toBe("Gandalf");
    expect(row?.created_at).toBeInstanceOf(Date);
  });

  it("retourne null si l'utilisateur n'existe pas", async () => {
    expect(await dao.findById("absent")).toBeNull();
  });
});
