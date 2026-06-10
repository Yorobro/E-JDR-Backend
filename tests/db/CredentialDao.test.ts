import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "mysql2/promise";

import { CredentialDao } from "@infrastructure/persistence/mysql/features/auth/dao/CredentialDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

/**
 * Tests d'intégration du `CredentialDao` contre un MySQL réel (Testcontainers).
 *
 * Couvre le CRUD, les contraintes (UNIQUE e-mail, FK user_id) et les champs
 * anti-brute-force (`failed_attempts`, `locked_until`) ajoutés par V003.
 */
describe("CredentialDao (intégration MySQL)", () => {
  let pool: Pool;
  let dao: CredentialDao;

  const baseRow = {
    id: "cred-1",
    user_id: "user-1",
    email: "me@test.com",
    password_hash: "bcrypt-hash",
    created_at: new Date("2026-01-02T08:30:00Z"),
    failed_attempts: 0,
    locked_until: null as Date | null,
  };

  beforeAll(() => {
    pool = createTestPool();
    dao = new CredentialDao(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "user-1");
  });

  it("insert puis findByEmail renvoie la ligne complète", async () => {
    await dao.insert(baseRow);

    const row = await dao.findByEmail("me@test.com");

    expect(row).not.toBeNull();
    expect(row!.id).toBe("cred-1");
    expect(row!.user_id).toBe("user-1");
    expect(row!.password_hash).toBe("bcrypt-hash");
    expect(row!.failed_attempts).toBe(0);
    expect(row!.locked_until).toBeNull();
    expect(row!.created_at.getTime()).toBe(baseRow.created_at.getTime());
  });

  it("findByUserId renvoie la ligne du bon utilisateur", async () => {
    await dao.insert(baseRow);

    const row = await dao.findByUserId("user-1");

    expect(row).not.toBeNull();
    expect(row!.email).toBe("me@test.com");
  });

  it("findByUserId renvoie null pour un utilisateur sans credential", async () => {
    expect(await dao.findByUserId("user-1")).toBeNull();
  });

  it("existsByEmail distingue présent/absent", async () => {
    await dao.insert(baseRow);

    expect(await dao.existsByEmail("me@test.com")).toBe(true);
    expect(await dao.existsByEmail("other@test.com")).toBe(false);
  });

  it("update persiste les champs de verrouillage", async () => {
    await dao.insert(baseRow);
    const lockedUntil = new Date("2026-01-02T09:00:00Z");

    await dao.update("cred-1", { failed_attempts: 5, locked_until: lockedUntil });

    const row = await dao.findByEmail("me@test.com");
    expect(row!.failed_attempts).toBe(5);
    expect(row!.locked_until!.getTime()).toBe(lockedUntil.getTime());
  });

  it("insert refuse un e-mail en double (UNIQUE)", async () => {
    await dao.insert(baseRow);
    await insertUser(pool, "user-2");

    await expect(dao.insert({ ...baseRow, id: "cred-2", user_id: "user-2" })).rejects.toThrow();
  });

  it("insert refuse un user_id inexistant (FK)", async () => {
    await expect(dao.insert({ ...baseRow, user_id: "ghost" })).rejects.toThrow();
  });
});
