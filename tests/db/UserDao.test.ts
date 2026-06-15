import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "mysql2/promise";

import { UserDao } from "@infrastructure/persistence/mysql/features/auth/dao/UserDao";
import { createTestPool, clearAllTables } from "./dbTestUtils";

/**
 * Tests d'intégration du `UserDao` contre un MySQL réel (Testcontainers).
 *
 * Valide le SQL et le schéma migré — ce que les tests unitaires (fakes) ne voient pas.
 * Les dates utilisent des secondes entières : `DATETIME` ne stocke pas les millisecondes.
 */
describe("UserDao (intégration MySQL)", () => {
  let pool: Pool;
  let dao: UserDao;

  beforeAll(() => {
    pool = createTestPool();
    dao = new UserDao(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
  });

  it("insert puis findById renvoie la ligne insérée", async () => {
    const createdAt = new Date("2026-01-02T08:30:00Z");
    await dao.insert({ id: "user-1", pseudo: "Gandalf", created_at: createdAt });

    const row = await dao.findById("user-1");

    expect(row).not.toBeNull();
    expect(row!.id).toBe("user-1");
    expect(row!.pseudo).toBe("Gandalf");
    expect(row!.created_at.getTime()).toBe(createdAt.getTime());
  });

  it("findById renvoie null pour un id inconnu", async () => {
    const row = await dao.findById("ghost");

    expect(row).toBeNull();
  });

  it("insert refuse un id en double (PRIMARY KEY)", async () => {
    await dao.insert({
      id: "user-1",
      pseudo: "Gandalf",
      created_at: new Date("2026-01-02T08:30:00Z"),
    });

    await expect(
      dao.insert({ id: "user-1", pseudo: "Gandalf", created_at: new Date("2026-01-02T09:00:00Z") }),
    ).rejects.toThrow();
  });
});
