import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "mysql2/promise";

import { RefreshTokenDao } from "@infrastructure/persistence/mysql/auth/dao/RefreshTokenDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

/**
 * Tests d'intégration du `RefreshTokenDao` contre un MySQL réel (Testcontainers).
 *
 * Couvre le cycle de vie des sessions révocables : insertion, recherche par empreinte,
 * révocations ciblées et purge des jetons expirés (index `expires_at` de V002).
 */
describe("RefreshTokenDao (intégration MySQL)", () => {
  let pool: Pool;
  let dao: RefreshTokenDao;

  function buildRow(id: string, userId: string, tokenHash: string, expiresAt: Date) {
    return {
      id,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: new Date("2026-01-02T08:30:00Z"),
    };
  }

  beforeAll(() => {
    pool = createTestPool();
    dao = new RefreshTokenDao(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "user-1");
    await insertUser(pool, "user-2");
  });

  it("insert puis findByTokenHash renvoie la ligne", async () => {
    const expiresAt = new Date("2026-02-01T00:00:00Z");
    await dao.insert(buildRow("rt-1", "user-1", "hash-1", expiresAt));

    const row = await dao.findByTokenHash("hash-1");

    expect(row).not.toBeNull();
    expect(row!.user_id).toBe("user-1");
    expect(row!.expires_at.getTime()).toBe(expiresAt.getTime());
  });

  it("findByTokenHash renvoie null pour une empreinte inconnue", async () => {
    expect(await dao.findByTokenHash("ghost")).toBeNull();
  });

  it("deleteByTokenHash supprime uniquement la ligne visée", async () => {
    await dao.insert(buildRow("rt-1", "user-1", "hash-1", new Date("2026-02-01T00:00:00Z")));
    await dao.insert(buildRow("rt-2", "user-1", "hash-2", new Date("2026-02-01T00:00:00Z")));

    await dao.deleteByTokenHash("hash-1");

    expect(await dao.findByTokenHash("hash-1")).toBeNull();
    expect(await dao.findByTokenHash("hash-2")).not.toBeNull();
  });

  it("deleteAllForUser supprime toutes les sessions d'un utilisateur sans toucher les autres", async () => {
    await dao.insert(buildRow("rt-1", "user-1", "hash-1", new Date("2026-02-01T00:00:00Z")));
    await dao.insert(buildRow("rt-2", "user-1", "hash-2", new Date("2026-02-01T00:00:00Z")));
    await dao.insert(buildRow("rt-3", "user-2", "hash-3", new Date("2026-02-01T00:00:00Z")));

    await dao.deleteAllForUser("user-1");

    expect(await dao.findByTokenHash("hash-1")).toBeNull();
    expect(await dao.findByTokenHash("hash-2")).toBeNull();
    expect(await dao.findByTokenHash("hash-3")).not.toBeNull();
  });

  it("deleteExpired purge les jetons expirés et conserve les valides", async () => {
    const now = new Date("2026-01-15T00:00:00Z");
    await dao.insert(buildRow("rt-1", "user-1", "hash-expired", new Date("2026-01-10T00:00:00Z")));
    await dao.insert(buildRow("rt-2", "user-1", "hash-valid", new Date("2026-02-01T00:00:00Z")));

    await dao.deleteExpired(now);

    expect(await dao.findByTokenHash("hash-expired")).toBeNull();
    expect(await dao.findByTokenHash("hash-valid")).not.toBeNull();
  });

  it("insert refuse une empreinte en double (UNIQUE token_hash)", async () => {
    await dao.insert(buildRow("rt-1", "user-1", "hash-1", new Date("2026-02-01T00:00:00Z")));

    await expect(
      dao.insert(buildRow("rt-2", "user-2", "hash-1", new Date("2026-02-01T00:00:00Z"))),
    ).rejects.toThrow();
  });
});
