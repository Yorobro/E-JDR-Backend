import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import { Pool } from "mysql2/promise";
import * as schema from "@infrastructure/persistence/drizzle/schema";
import {
  CharacterSheetDao,
  CharacterSheetWriteRow,
} from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";
import { createTestPool, clearAllTables, insertUser, insertFriendGroup } from "./dbTestUtils";

function writeRow(over: Partial<CharacterSheetWriteRow>): CharacterSheetWriteRow {
  return {
    id: "s-1",
    owner_id: "owner-1",
    group_id: "group-1",
    name: "Aragorn",
    created_at: new Date("2026-01-01T10:00:00Z"),
    formation_id: null,
    niveau: null,
    peuple_id: null,
    sexe: null,
    taille_et_poids: null,
    age: null,
    apparence: null,
    dexterite: null,
    intelligence: null,
    perception: null,
    social: null,
    vigueur: null,
    points_de_vie: null,
    points_de_magie: null,
    protection: null,
    purse_gold: null,
    purse_silver: null,
    purse_copper: null,
    notes: null,
    ...over,
  };
}

describe("CharacterSheetDao (intégration MySQL via Drizzle)", () => {
  let pool: Pool;
  let db: MySql2Database<typeof schema>;
  let dao: CharacterSheetDao;

  beforeAll(() => {
    pool = createTestPool();
    db = drizzle(pool, { schema, mode: "default" });
    dao = new CharacterSheetDao(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "owner-1");
    await insertUser(pool, "mj-1");
    // group-1 satisfait la FK character_sheets.group_id (et campaigns.group_id).
    await insertFriendGroup(pool, "group-1", "owner-1");
  });

  it("insère et relit une fiche complète", async () => {
    await dao.insert(writeRow({ niveau: 3, points_de_vie: 12, purse_gold: 5 }));
    const found = await dao.findById("s-1");
    expect(found?.name).toBe("Aragorn");
    expect(found?.niveau).toBe(3);
    expect(found?.points_de_vie).toBe(12);
    expect(found?.purse_gold).toBe(5);
    expect(found?.created_at).toBeInstanceOf(Date);
  });

  it("met à jour name + détails sans toucher owner/created_at", async () => {
    const created = new Date("2026-01-01T10:00:00Z");
    await dao.insert(writeRow({ created_at: created }));
    await dao.update(writeRow({ name: "Frodo", niveau: 7, created_at: new Date("2030-01-01") }));
    const found = await dao.findById("s-1");
    expect(found?.name).toBe("Frodo");
    expect(found?.niveau).toBe(7);
    expect(found?.owner_id).toBe("owner-1");
    expect(found?.created_at.getTime()).toBe(created.getTime());
  });

  it("liste les fiches d'un propriétaire (plus récentes d'abord)", async () => {
    await dao.insert(writeRow({ id: "s-old", created_at: new Date("2026-01-01T10:00:00Z") }));
    await dao.insert(writeRow({ id: "s-new", created_at: new Date("2026-03-01T10:00:00Z") }));
    const list = await dao.findByOwnerId("owner-1");
    expect(list.map((s) => s.id)).toEqual(["s-new", "s-old"]);
  });

  it("supprime par id", async () => {
    await dao.insert(writeRow({}));
    await dao.deleteById("s-1");
    expect(await dao.findById("s-1")).toBeNull();
  });

  it("rejette une fiche sans owner existant (FK)", async () => {
    await expect(dao.insert(writeRow({ id: "s-x", owner_id: "fantome" }))).rejects.toThrow();
  });

  it("findLinkableForCampaign : fiches du groupe de la campagne, hors fiches du MJ et déjà liées", async () => {
    await pool.execute(
      "INSERT INTO campaigns (id, group_id, game_master_id, name, created_at) VALUES (?,?,?,?,?)",
      ["camp-1", "group-1", "mj-1", "Camp", new Date("2026-01-01T10:00:00Z")],
    );
    await dao.insert(writeRow({ id: "s-mj", owner_id: "mj-1" }));
    await dao.insert(writeRow({ id: "s-linked", owner_id: "owner-1" }));
    await pool.execute(
      "INSERT INTO campaign_characters (campaign_id, character_sheet_id, created_at) VALUES (?,?,?)",
      ["camp-1", "s-linked", new Date("2026-01-02T10:00:00Z")],
    );
    await dao.insert(writeRow({ id: "s-free", owner_id: "owner-1" }));
    // Fiche d'un AUTRE groupe : ne doit pas être proposée même si non liée et pas au MJ.
    await insertFriendGroup(pool, "group-2", "owner-1");
    await dao.insert(writeRow({ id: "s-other-group", owner_id: "owner-1", group_id: "group-2" }));

    const linkable = await dao.findLinkableForCampaign("group-1", "mj-1", "camp-1");
    expect(linkable.map((s) => s.id)).toEqual(["s-free"]);
  });
});
