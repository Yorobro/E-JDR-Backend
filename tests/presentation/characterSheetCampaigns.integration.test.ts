import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";
import { authenticate, createGroup, joinGroup, createPendingSheet } from "./sheetTestHelpers";

/**
 * Tests d'intégration HTTP de `GET /character-sheets/:id/campaigns` : pile Express réelle sur
 * doublures. Valide la projection (nom de campagne + pseudo du MJ + statut de rattachement) et
 * l'autorisation propriétaire.
 *
 * Modèle « une fiche = une campagne » : une fiche est créée rattachée à une campagne (statut
 * PENDING) ; l'endpoint renvoie donc toujours 0 ou 1 campagne. La consultation reste réservée au
 * PROPRIÉTAIRE de la fiche (et non à tout le groupe).
 */
describe("GET /character-sheets/:id/campaigns (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  it("renvoie la campagne rattachée à la fiche avec le pseudo du MJ et le statut (200)", async () => {
    const player = await authenticate(app, "player@test.com", "Joueur");
    const groupId = await createGroup(player);
    const { sheet, campaignId } = await createPendingSheet(app, player, groupId, "Legolas");

    const res = await player.get(`/character-sheets/${sheet.id}/campaigns`);

    expect(res.status).toBe(200);
    expect(res.body.campaigns).toHaveLength(1);
    expect(res.body.campaigns[0].campaignId).toBe(campaignId);
    expect(res.body.campaigns[0].campaignName).toBe("Campagne du MJ");
    expect(res.body.campaigns[0].gameMasterPseudo).toBe("MJ");
    // La fiche fraîchement créée est en attente de validation du MJ.
    expect(res.body.campaigns[0].linkStatus).toBe("PENDING");
  });

  it("renvoie 403 si le demandeur n'est pas le propriétaire de la fiche (même membre du groupe)", async () => {
    // L'accès aux campagnes d'une fiche reste réservé au propriétaire, même pour un autre membre.
    const owner = await authenticate(app, "owner@test.com", "Owner");
    const groupId = await createGroup(owner);
    const { sheet } = await createPendingSheet(app, owner, groupId, "Privée");

    const mate = await authenticate(app, "mate@test.com", "Mate");
    await joinGroup(owner, groupId, mate, "mate@test.com");

    const res = await mate.get(`/character-sheets/${sheet.id}/campaigns`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
  });

  it("renvoie 404 pour une fiche inconnue", async () => {
    const player = await authenticate(app, "player@test.com", "Joueur");
    const res = await player.get("/character-sheets/inconnu/campaigns");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CHARACTER_SHEET_NOT_FOUND");
  });

  it("renvoie 401 sans cookie de session", async () => {
    const res = await request(app).get("/character-sheets/whatever/campaigns");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});
