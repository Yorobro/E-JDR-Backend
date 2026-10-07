import { describe, it, expect } from "vitest";
import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import { Sex } from "@domain/features/character-sheet/value-objects/Sex";
import { Purse } from "@domain/features/character-sheet/value-objects/Purse";
import { LinkStatus } from "@domain/features/character-sheet/value-objects/LinkStatus";

describe("CharacterSheet (entité)", () => {
  const build = (ownerId = "user-1", groupId = "group-1"): CharacterSheet =>
    CharacterSheet.create({
      id: "sheet-1",
      ownerId,
      groupId,
      campaignId: "campaign-1",
      name: CharacterSheetName.create("Aragorn"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

  it("create établit le propriétaire", () => {
    expect(build("owner-42").ownerId).toBe("owner-42");
  });

  it("create établit le groupe", () => {
    expect(build("owner-42", "g-7").groupId).toBe("g-7");
  });

  it("isInGroup renvoie true pour le groupe de la fiche, false sinon", () => {
    const sheet = build("owner-42", "g-7");
    expect(sheet.isInGroup("g-7")).toBe(true);
    expect(sheet.isInGroup("autre")).toBe(false);
  });

  it("groupId n'apparaît pas dans les champs détaillés", () => {
    expect("groupId" in build().details).toBe(false);
  });

  it("expose le nom sous forme de value object", () => {
    const sheet = build();
    expect(sheet.name).toBeInstanceOf(CharacterSheetName);
    expect(sheet.name.value).toBe("Aragorn");
  });

  it("isOwnedBy renvoie true pour le propriétaire, false sinon", () => {
    const sheet = build("owner-42");
    expect(sheet.isOwnedBy("owner-42")).toBe(true);
    expect(sheet.isOwnedBy("autre")).toBe(false);
  });

  it("create initialise les champs sans défaut à null", () => {
    const sheet = build();
    expect(sheet.details.peupleId).toBeNull();
    expect(sheet.details.notes).toBeNull();
    expect(sheet.details.pointsDeVie).toBeNull();
    expect(sheet.details.protection).toBeNull();
  });

  it("create applique les défauts (niveau=1, stats=0, PM=10)", () => {
    const sheet = CharacterSheet.create({
      id: "sheet-1",
      ownerId: "user-1",
      groupId: "group-1",
      campaignId: "campaign-1",
      name: CharacterSheetName.create("Aragorn"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(sheet.details.niveau).toBe(1);
    expect(sheet.details.dexterite).toBe(0);
    expect(sheet.details.intelligence).toBe(0);
    expect(sheet.details.perception).toBe(0);
    expect(sheet.details.social).toBe(0);
    expect(sheet.details.vigueur).toBe(0);
    expect(sheet.details.pointsDeMagie).toBe(10);
    // bourse à 0 par défaut (or/argent/cuivre)
    expect(sheet.details.purse?.gold).toBe(0);
    expect(sheet.details.purse?.silver).toBe(0);
    expect(sheet.details.purse?.copper).toBe(0);
    // les autres restent null
    expect(sheet.details.pointsDeVie).toBeNull();
    expect(sheet.details.protection).toBeNull();
    expect(sheet.details.notes).toBeNull();
  });

  it("create respecte les valeurs fournies (priment sur les défauts)", () => {
    const sheet = CharacterSheet.create({
      id: "sheet-1",
      ownerId: "user-1",
      groupId: "group-1",
      campaignId: "campaign-1",
      name: CharacterSheetName.create("Aragorn"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      niveau: 5,
      vigueur: 3,
    });
    expect(sheet.details.niveau).toBe(5);
    expect(sheet.details.vigueur).toBe(3);
    // les défauts des autres champs sont toujours appliqués
    expect(sheet.details.dexterite).toBe(0);
    expect(sheet.details.pointsDeMagie).toBe(10);
  });

  it("restore ne force aucun défaut (null reste null)", () => {
    const sheet = CharacterSheet.restore({
      id: "sheet-9",
      ownerId: "owner-9",
      groupId: "group-9",
      campaignId: "campaign-9",
      linkStatus: LinkStatus.PENDING,
      name: CharacterSheetName.create("Legolas"),
      createdAt: new Date("2026-02-03T10:00:00Z"),
      formationId: null,
      niveau: null,
      peupleId: null,
      sexe: null,
      tailleEtPoids: null,
      age: null,
      apparence: null,
      dexterite: null,
      intelligence: null,
      perception: null,
      social: null,
      vigueur: null,
      pointsDeVie: null,
      pointsDeMagie: null,
      protection: null,
      purse: null,
      notes: null,
    });
    expect(sheet.details.niveau).toBeNull();
    expect(sheet.details.dexterite).toBeNull();
    expect(sheet.details.intelligence).toBeNull();
    expect(sheet.details.perception).toBeNull();
    expect(sheet.details.social).toBeNull();
    expect(sheet.details.vigueur).toBeNull();
    expect(sheet.details.pointsDeMagie).toBeNull();
  });

  it("create accepte des champs détaillés optionnels", () => {
    const sheet = CharacterSheet.create({
      id: "sheet-1",
      ownerId: "user-1",
      groupId: "group-1",
      campaignId: "campaign-1",
      name: CharacterSheetName.create("Aragorn"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      peupleId: "peuple-1",
      niveau: 5,
      age: 87,
      sexe: Sex.create("M"),
      vigueur: 6,
      purse: Purse.create({ gold: 2 }),
    });
    expect(sheet.details.peupleId).toBe("peuple-1");
    expect(sheet.details.niveau).toBe(5);
    expect(sheet.details.age).toBe(87);
    expect(sheet.details.sexe?.value).toBe("M");
    expect(sheet.details.vigueur).toBe(6);
    expect(sheet.details.purse?.gold).toBe(2);
    expect(sheet.details.formationId).toBeNull();
  });

  it("withDetails produit une nouvelle instance sans muter l'originale", () => {
    const original = build();
    const updated = original.withDetails({
      name: CharacterSheetName.create("Strider"),
      peupleId: "peuple-2",
      vigueur: 7,
    });

    // L'originale est inchangée (immutabilité).
    expect(original.name.value).toBe("Aragorn");
    expect(original.details.peupleId).toBeNull();

    // La nouvelle reflète les changements, identité technique préservée.
    expect(updated.id).toBe(original.id);
    expect(updated.ownerId).toBe(original.ownerId);
    expect(updated.createdAt.getTime()).toBe(original.createdAt.getTime());
    expect(updated.name.value).toBe("Strider");
    expect(updated.details.peupleId).toBe("peuple-2");
    expect(updated.details.vigueur).toBe(7);
  });

  it("restore reconstruit fidèlement (round-trip)", () => {
    const sheet = CharacterSheet.restore({
      ...build().details,
      id: "sheet-9",
      ownerId: "owner-9",
      groupId: "group-9",
      campaignId: "campaign-9",
      linkStatus: LinkStatus.ACCEPTED,
      name: CharacterSheetName.create("Legolas"),
      createdAt: new Date("2026-02-03T10:00:00Z"),
      perception: 8,
    });
    expect(sheet.id).toBe("sheet-9");
    expect(sheet.ownerId).toBe("owner-9");
    expect(sheet.groupId).toBe("group-9");
    expect(sheet.campaignId).toBe("campaign-9");
    expect(sheet.linkStatus).toBe(LinkStatus.ACCEPTED);
    expect(sheet.name.value).toBe("Legolas");
    expect(sheet.createdAt.getTime()).toBe(new Date("2026-02-03T10:00:00Z").getTime());
    expect(sheet.details.perception).toBe(8);
  });

  it("create établit la campagne et le statut PENDING par défaut", () => {
    const sheet = build();
    expect(sheet.campaignId).toBe("campaign-1");
    expect(sheet.isPending()).toBe(true);
    expect(sheet.linkStatus).toBe(LinkStatus.PENDING);
  });

  it("accept passe le statut à ACCEPTED sans muter l'originale", () => {
    const original = build();
    const accepted = original.accept();
    expect(original.isPending()).toBe(true);
    expect(accepted.isPending()).toBe(false);
    expect(accepted.linkStatus).toBe(LinkStatus.ACCEPTED);
  });

  it("copyTo duplique la fiche vers une autre campagne en PENDING avec un nouvel id", () => {
    const source = build().accept();
    const copy = source.copyTo("sheet-copie", "campaign-2", new Date("2026-05-05T00:00:00Z"));
    expect(copy.id).toBe("sheet-copie");
    expect(copy.campaignId).toBe("campaign-2");
    expect(copy.isPending()).toBe(true);
    expect(copy.ownerId).toBe(source.ownerId);
    expect(copy.name.value).toBe(source.name.value);
    expect(copy.createdAt.getTime()).toBe(new Date("2026-05-05T00:00:00Z").getTime());
  });
});
