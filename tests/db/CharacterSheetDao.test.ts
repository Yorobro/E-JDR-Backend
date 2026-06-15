import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "mysql2/promise";

import {
  CharacterSheetDao,
  CharacterSheetWriteRow,
} from "@infrastructure/persistence/mysql/features/character-sheet/dao/CharacterSheetDao";
import { CampaignCharacterDao } from "@infrastructure/persistence/mysql/features/character-sheet/dao/CampaignCharacterDao";
import { createTestPool, clearAllTables, insertUser } from "./dbTestUtils";

/** Construit une ligne d'écriture complète : colonnes détaillées à `null` par défaut. */
function sheetRow(
  partial: Pick<CharacterSheetWriteRow, "id" | "owner_id" | "name" | "created_at"> &
    Partial<CharacterSheetWriteRow>,
): CharacterSheetWriteRow {
  return {
    formation: null,
    niveau: null,
    peuple: null,
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
    armures: null,
    armes: null,
    competences: null,
    equipement: null,
    sorts_et_miracles: null,
    notes: null,
    ...partial,
  };
}

/**
 * Tests d'intégration des DAO fiches et liaison contre un MySQL réel (Testcontainers).
 *
 * Valide le SQL et le schéma migré (V005 : `character_sheets` + `campaign_characters`, FK,
 * PK composite anti-doublon, JOIN de lecture ; V006 : colonnes détaillées).
 */
describe("CharacterSheet / CampaignCharacter DAO (intégration MySQL)", () => {
  let pool: Pool;
  let sheetDao: CharacterSheetDao;
  let linkDao: CampaignCharacterDao;

  beforeAll(() => {
    pool = createTestPool();
    sheetDao = new CharacterSheetDao(pool);
    linkDao = new CampaignCharacterDao(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  /** Insère une campagne (avec son MJ) pour satisfaire les FK de la liaison. */
  async function insertCampaign(id: string, gameMasterId: string): Promise<void> {
    await pool.execute(
      "INSERT INTO campaigns (id, game_master_id, name, created_at) VALUES (?, ?, ?, ?)",
      [id, gameMasterId, "Campagne", new Date("2026-01-01T10:00:00Z")],
    );
  }

  beforeEach(async () => {
    await clearAllTables(pool);
    await insertUser(pool, "owner-1");
    await insertUser(pool, "mj-1");
  });

  it("insert + findByOwnerId + findById + deleteById sur character_sheets", async () => {
    const createdAt = new Date("2026-01-02T08:30:00Z");
    await sheetDao.insert(
      sheetRow({ id: "s-1", owner_id: "owner-1", name: "Aragorn", created_at: createdAt }),
    );

    const byOwner = await sheetDao.findByOwnerId("owner-1");
    expect(byOwner).toHaveLength(1);
    expect(byOwner[0]!.name).toBe("Aragorn");

    const byId = await sheetDao.findById("s-1");
    expect(byId).not.toBeNull();
    expect(byId!.created_at.getTime()).toBe(createdAt.getTime());

    await sheetDao.deleteById("s-1");
    expect(await sheetDao.findById("s-1")).toBeNull();
  });

  it("insert refuse un owner_id inexistant (FK)", async () => {
    await expect(
      sheetDao.insert(
        sheetRow({ id: "orphan", owner_id: "fantome", name: "X", created_at: new Date() }),
      ),
    ).rejects.toThrow();
  });

  it("insert + findById + update préservent les champs détaillés (V006)", async () => {
    await sheetDao.insert(
      sheetRow({
        id: "s-detail",
        owner_id: "owner-1",
        name: "Gandalf",
        created_at: new Date("2026-01-02T09:00:00Z"),
        peuple: "Istari",
        niveau: 20,
        sexe: "M",
        vigueur: 5,
        points_de_vie: 15,
        competences: "Magie, Sagesse",
        purse_gold: 1,
        purse_silver: 50,
        purse_copper: 0,
        notes: "Un magicien n'est jamais en retard.",
      }),
    );

    const inserted = await sheetDao.findById("s-detail");
    expect(inserted).not.toBeNull();
    expect(inserted!.peuple).toBe("Istari");
    expect(inserted!.niveau).toBe(20);
    expect(inserted!.sexe).toBe("M");
    expect(inserted!.vigueur).toBe(5);
    expect(inserted!.points_de_vie).toBe(15);
    expect(inserted!.competences).toBe("Magie, Sagesse");
    expect(inserted!.purse_gold).toBe(1);
    expect(inserted!.purse_silver).toBe(50);
    expect(inserted!.purse_copper).toBe(0);
    expect(inserted!.notes).toBe("Un magicien n'est jamais en retard.");
    // Colonnes non renseignées : NULL.
    expect(inserted!.formation).toBeNull();
    expect(inserted!.protection).toBeNull();

    await sheetDao.update(
      sheetRow({
        id: "s-detail",
        owner_id: "owner-1",
        name: "Gandalf le Blanc",
        created_at: new Date("2999-01-01T00:00:00Z"), // ignoré par update
        peuple: "Istari",
        vigueur: 7,
        purse_gold: 2,
      }),
    );

    const updated = await sheetDao.findById("s-detail");
    expect(updated!.name).toBe("Gandalf le Blanc");
    expect(updated!.vigueur).toBe(7);
    expect(updated!.purse_gold).toBe(2);
    // update ne réécrit pas les champs absents → remis à null, mais created_at inchangé.
    expect(updated!.points_de_vie).toBeNull();
    expect(updated!.created_at.getTime()).toBe(new Date("2026-01-02T09:00:00Z").getTime());
  });

  it("link + existsByCampaignAndSheet + findSheetsByCampaignId + delete sur la liaison", async () => {
    await insertCampaign("camp-1", "mj-1");
    await sheetDao.insert(
      sheetRow({
        id: "s-1",
        owner_id: "owner-1",
        name: "Frodo",
        created_at: new Date("2026-01-02T08:00:00Z"),
      }),
    );

    await linkDao.insert({
      campaign_id: "camp-1",
      character_sheet_id: "s-1",
      created_at: new Date(),
    });
    expect(await linkDao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(true);

    const sheets = await linkDao.findSheetsByCampaignId("camp-1");
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.name).toBe("Frodo");

    await linkDao.delete("camp-1", "s-1");
    expect(await linkDao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(false);
  });

  it("findCampaignViewsBySheetId renvoie le nom de la campagne et le pseudo du MJ", async () => {
    // MJ dédié avec un pseudo explicite (le "mj-1" du beforeEach a un pseudo dérivé de l'id).
    await insertUser(pool, "mj-pseudo", "MJ");
    await insertCampaign("camp-1", "mj-pseudo");
    await sheetDao.insert(
      sheetRow({
        id: "s-1",
        owner_id: "owner-1",
        name: "Frodo",
        created_at: new Date("2026-01-02T08:00:00Z"),
      }),
    );
    await linkDao.insert({
      campaign_id: "camp-1",
      character_sheet_id: "s-1",
      created_at: new Date(),
    });

    const views = await linkDao.findCampaignViewsBySheetId("s-1");

    expect(views).toHaveLength(1);
    expect(views[0]!.campaign_id).toBe("camp-1");
    expect(views[0]!.campaign_name).toBe("Campagne");
    expect(views[0]!.game_master_pseudo).toBe("MJ");
  });

  it("la PK composite empêche les doublons de rattachement", async () => {
    await insertCampaign("camp-1", "mj-1");
    await sheetDao.insert(
      sheetRow({ id: "s-1", owner_id: "owner-1", name: "Sam", created_at: new Date() }),
    );
    await linkDao.insert({
      campaign_id: "camp-1",
      character_sheet_id: "s-1",
      created_at: new Date(),
    });

    await expect(
      linkDao.insert({ campaign_id: "camp-1", character_sheet_id: "s-1", created_at: new Date() }),
    ).rejects.toThrow();
  });

  it("supprimer une fiche retire ses liaisons (ON DELETE CASCADE)", async () => {
    await insertCampaign("camp-1", "mj-1");
    await sheetDao.insert(
      sheetRow({ id: "s-1", owner_id: "owner-1", name: "Merry", created_at: new Date() }),
    );
    await linkDao.insert({
      campaign_id: "camp-1",
      character_sheet_id: "s-1",
      created_at: new Date(),
    });

    await sheetDao.deleteById("s-1");

    expect(await linkDao.existsByCampaignAndSheet("camp-1", "s-1")).toBe(false);
  });

  it("findLinkableForCampaign exclut les fiches du MJ et les fiches déjà liées", async () => {
    // beforeEach a déjà inséré "owner-1" (PLAYER) et "mj-1" (GM).
    // On ajoute un second joueur pour la fiche déjà liée.
    await insertUser(pool, "player-2");

    await insertCampaign("camp-1", "mj-1");

    // Fiche A : appartient au MJ → exclue
    await sheetDao.insert(
      sheetRow({
        id: "sheet-gm",
        owner_id: "mj-1",
        name: "Fiche du MJ",
        created_at: new Date("2026-01-01T08:00:00Z"),
      }),
    );

    // Fiche B : appartient à PLAYER → attendue dans le résultat
    await sheetDao.insert(
      sheetRow({
        id: "sheet-player",
        owner_id: "owner-1",
        name: "Fiche du Joueur",
        created_at: new Date("2026-01-02T08:00:00Z"),
      }),
    );

    // Fiche C : appartient à PLAYER2, mais déjà liée → exclue
    await sheetDao.insert(
      sheetRow({
        id: "sheet-linked",
        owner_id: "player-2",
        name: "Fiche déjà liée",
        created_at: new Date("2026-01-03T08:00:00Z"),
      }),
    );
    await linkDao.insert({
      campaign_id: "camp-1",
      character_sheet_id: "sheet-linked",
      created_at: new Date(),
    });

    const result = await sheetDao.findLinkableForCampaign("mj-1", "camp-1");

    const ids = result.map((r) => r.id);
    expect(ids).toContain("sheet-player");
    expect(ids).not.toContain("sheet-gm");
    expect(ids).not.toContain("sheet-linked");
    expect(result).toHaveLength(1);
  });
});
