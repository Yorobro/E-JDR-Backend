import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "mysql2/promise";

import { CampaignDao } from "@infrastructure/persistence/mysql/features/campaign/dao/CampaignDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

/**
 * Tests d'intégration du `CampaignDao` contre un MySQL réel (Testcontainers).
 *
 * Valide le SQL et le schéma migré (table `campaigns`, FK vers `users`) — ce que les tests
 * unitaires (fakes) ne voient pas. Les dates utilisent des secondes entières : `DATETIME`
 * ne stocke pas les millisecondes.
 */
describe("CampaignDao (intégration MySQL)", () => {
  let pool: Pool;
  let dao: CampaignDao;

  beforeAll(() => {
    pool = createTestPool();
    dao = new CampaignDao(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    // La table `campaigns` a une FK vers `users` : on insère le MJ d'abord.
    await insertUser(pool, "mj-1");
    await insertUser(pool, "mj-2");
  });

  it("insert puis findByGameMasterId renvoie la campagne insérée", async () => {
    const createdAt = new Date("2026-01-02T08:30:00Z");
    await dao.insert({
      id: "campaign-1",
      game_master_id: "mj-1",
      name: "Ma campagne",
      created_at: createdAt,
    });

    const rows = await dao.findByGameMasterId("mj-1");

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("campaign-1");
    expect(rows[0]!.name).toBe("Ma campagne");
    expect(rows[0]!.created_at.getTime()).toBe(createdAt.getTime());
  });

  it("findByGameMasterId ne renvoie que les campagnes du MJ demandé", async () => {
    await dao.insert({
      id: "c-1",
      game_master_id: "mj-1",
      name: "Alpha",
      created_at: new Date("2026-01-02T08:00:00Z"),
    });
    await dao.insert({
      id: "c-2",
      game_master_id: "mj-2",
      name: "Beta",
      created_at: new Date("2026-01-02T09:00:00Z"),
    });

    const rows = await dao.findByGameMasterId("mj-1");

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("c-1");
  });

  it("findByGameMasterId trie des plus récentes aux plus anciennes", async () => {
    await dao.insert({
      id: "vieux",
      game_master_id: "mj-1",
      name: "Vieux",
      created_at: new Date("2026-01-01T00:00:00Z"),
    });
    await dao.insert({
      id: "recent",
      game_master_id: "mj-1",
      name: "Récent",
      created_at: new Date("2026-03-01T00:00:00Z"),
    });

    const rows = await dao.findByGameMasterId("mj-1");

    expect(rows.map((r) => r.id)).toEqual(["recent", "vieux"]);
  });

  it("findByGameMasterId renvoie un tableau vide pour un MJ sans campagne", async () => {
    const rows = await dao.findByGameMasterId("mj-2");
    expect(rows).toEqual([]);
  });

  it("insert refuse un game_master_id inexistant (contrainte FK)", async () => {
    await expect(
      dao.insert({
        id: "orphan",
        game_master_id: "fantome",
        name: "Orpheline",
        created_at: new Date("2026-01-02T08:30:00Z"),
      }),
    ).rejects.toThrow();
  });

  it("findById renvoie la ligne, ou null pour un id inconnu", async () => {
    await dao.insert({
      id: "c-1",
      game_master_id: "mj-1",
      name: "Trouvable",
      created_at: new Date("2026-01-02T08:00:00Z"),
    });

    const row = await dao.findById("c-1");
    expect(row).not.toBeNull();
    expect(row!.name).toBe("Trouvable");

    expect(await dao.findById("ghost")).toBeNull();
  });

  it("deleteById supprime la ligne (idempotent si absente)", async () => {
    await dao.insert({
      id: "c-1",
      game_master_id: "mj-1",
      name: "À supprimer",
      created_at: new Date("2026-01-02T08:00:00Z"),
    });

    await dao.deleteById("c-1");
    expect(await dao.findById("c-1")).toBeNull();

    // Idempotent : supprimer un id absent ne lève pas.
    await expect(dao.deleteById("c-1")).resolves.toBeUndefined();
  });
});
