import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import { PeupleStatBonusDao } from "@infrastructure/persistence/mysql/features/reference/dao/PeupleStatBonusDao";
import { createTestPool, clearAllTables, insertUser, insertFriendGroup } from "./dbTestUtils";

/**
 * Deux garanties de cette table ne vivent **qu'en SQL** et ne peuvent donc pas être prouvées par un
 * fake : la **PK composite `(peuple_id, stat)`** (un peuple ne peut pas porter deux bonus sur la
 * même statistique) et le **`ON DELETE cascade`** depuis `peoples`. D'où ce test d'intégration.
 */
describe("PeupleStatBonusDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: PeupleStatBonusDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new PeupleStatBonusDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "u-1");
    await insertFriendGroup(pool, "grp-1", "u-1");
    await insertPeuple("peuple-1", "Nain");
  });

  async function insertPeuple(id: string, name: string): Promise<void> {
    await pool.execute(
      "INSERT INTO peoples (id, group_id, name, created_at) VALUES (?, 'grp-1', ?, NOW())",
      [id, name],
    );
  }

  function row(peupleId: string, stat: string, bonus: number) {
    return { peuple_id: peupleId, stat, bonus, created_at: new Date("2026-01-01T10:00:00Z") };
  }

  it("insère plusieurs bonus pour un même peuple et les relit", async () => {
    await dao.insert(row("peuple-1", "vigueur", 2));
    await dao.insert(row("peuple-1", "social", 1));

    const found = await dao.findByPeuple("peuple-1");

    expect(found).toHaveLength(2);
    expect(found.map((b) => [b.stat, b.bonus]).sort()).toEqual([
      ["social", 1],
      ["vigueur", 2],
    ]);
  });

  it("renvoie une liste vide pour un peuple sans bonus", async () => {
    expect(await dao.findByPeuple("peuple-1")).toEqual([]);
  });

  it("REFUSE (PK composite) deux bonus sur la même statistique", async () => {
    await dao.insert(row("peuple-1", "vigueur", 2));

    // Drizzle enveloppe l'erreur MySQL (« Failed query: … ») : le code d'origine est dans la cause.
    const error: unknown = await dao.insert(row("peuple-1", "vigueur", 3)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as { cause?: { code?: string } }).cause?.code).toBe("ER_DUP_ENTRY");
    // Le premier bonus reste intact.
    expect(await dao.findByPeuple("peuple-1")).toHaveLength(1);
  });

  it("autorise la même statistique sur DEUX peuples différents", async () => {
    await insertPeuple("peuple-2", "Elfe");
    await dao.insert(row("peuple-1", "vigueur", 2));
    await dao.insert(row("peuple-2", "vigueur", 1));

    expect(await dao.findByPeuple("peuple-1")).toHaveLength(1);
    expect(await dao.findByPeuple("peuple-2")).toHaveLength(1);
  });

  it("supprime tous les bonus d'un peuple (remplacement complet)", async () => {
    await dao.insert(row("peuple-1", "vigueur", 2));
    await dao.insert(row("peuple-1", "social", 1));

    await dao.deleteByPeuple("peuple-1");

    expect(await dao.findByPeuple("peuple-1")).toEqual([]);
  });

  it("cascade la suppression du peuple sur ses bonus (ON DELETE cascade)", async () => {
    await dao.insert(row("peuple-1", "vigueur", 2));

    await pool.execute("DELETE FROM peoples WHERE id = 'peuple-1'");

    expect(await dao.findByPeuple("peuple-1")).toEqual([]);
  });
});
