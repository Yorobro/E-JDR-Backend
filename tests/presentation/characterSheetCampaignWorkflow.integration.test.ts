import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";
import {
  type Agent,
  authenticate,
  createGroup,
  joinGroup,
  createCampaign,
  provisionCampaignWithMj,
  createPendingSheet,
} from "./sheetTestHelpers";

/**
 * Tests d'intégration HTTP du workflow « personnages d'une campagne » (modèle « une fiche = une
 * campagne »), pile Express réelle sur doublures. Couvre la validation/refus des demandes de
 * rattachement par le MJ (`/campaigns/:id/characters/:sheetId/accept|refuse`), le listing des
 * personnages validés/en attente, et la copie d'une fiche vers une autre campagne
 * (`POST /character-sheets/:id/copy`).
 *
 * Extrait de `characterSheetRoutes.integration.test.ts` pour respecter la limite de taille de
 * fichier (`ejdr/file-size`).
 */
describe("Personnages d'une campagne — workflow (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  describe("Valider / refuser / lister les demandes de rattachement", () => {
    /**
     * Met en place un groupe avec un MJ (admin) et un joueur membre, une campagne du MJ, et une
     * fiche PENDING du joueur rattachée à cette campagne.
     */
    async function setupPendingRequest(): Promise<{
      mj: Agent;
      player: Agent;
      groupId: string;
      campaignId: string;
      sheetId: string;
    }> {
      const mj = await authenticate(app, "mj@test.com", "MJ");
      const groupId = await createGroup(mj, "Groupe");
      const campaignId = await createCampaign(mj, groupId, "Ma campagne");

      const player = await authenticate(app, "player@test.com", "Joueur");
      await joinGroup(mj, groupId, player, "player@test.com");
      const sheet = await player
        .post("/character-sheets")
        .send({ name: "Legolas", groupId, campaignId });

      return { mj, player, groupId, campaignId, sheetId: sheet.body.id as string };
    }

    it("le MJ liste les demandes en attente (PENDING) de sa campagne", async () => {
      const { mj, campaignId } = await setupPendingRequest();

      const res = await mj.get(`/campaigns/${campaignId}/pending-characters`);

      expect(res.status).toBe(200);
      expect(res.body.characters).toHaveLength(1);
      expect(res.body.characters[0].name).toBe("Legolas");
    });

    it("un non-MJ ne peut pas lister les demandes en attente (403)", async () => {
      const { player, campaignId } = await setupPendingRequest();

      const res = await player.get(`/campaigns/${campaignId}/pending-characters`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("le MJ valide une demande (accept) : la fiche devient ACCEPTED et apparaît dans les personnages", async () => {
      const { mj, campaignId, sheetId } = await setupPendingRequest();

      // Avant validation, la fiche n'est pas dans la liste des personnages (ACCEPTED) de la campagne.
      const before = await mj.get(`/campaigns/${campaignId}/characters`);
      expect(before.body.characters).toHaveLength(0);

      const accept = await mj.post(`/campaigns/${campaignId}/characters/${sheetId}/accept`);
      expect(accept.status).toBe(204);

      const after = await mj.get(`/campaigns/${campaignId}/characters`);
      expect(after.body.characters).toHaveLength(1);
      expect(after.body.characters[0].name).toBe("Legolas");
    });

    it("le MJ refuse une demande (refuse) : la fiche est supprimée", async () => {
      const { mj, player, campaignId, sheetId } = await setupPendingRequest();

      const refuse = await mj.post(`/campaigns/${campaignId}/characters/${sheetId}/refuse`);
      expect(refuse.status).toBe(204);

      // La fiche refusée a été supprimée : elle n'est plus accessible à son propriétaire.
      const get = await player.get(`/character-sheets/${sheetId}`);
      expect(get.status).toBe(404);
    });

    it("un non-MJ ne peut pas valider une demande (403)", async () => {
      const { player, campaignId, sheetId } = await setupPendingRequest();

      const res = await player.post(`/campaigns/${campaignId}/characters/${sheetId}/accept`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("accept d'une fiche absente / non rattachée renvoie 404", async () => {
      const { mj, campaignId } = await setupPendingRequest();

      const res = await mj.post(`/campaigns/${campaignId}/characters/inconnue/accept`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CHARACTER_SHEET_NOT_FOUND");
    });

    it("GET /campaigns/:id/characters ne liste que les fiches validées (ACCEPTED)", async () => {
      const { mj, campaignId, sheetId } = await setupPendingRequest();
      // Tant que la demande est PENDING, la liste des personnages validés est vide.
      const pendingList = await mj.get(`/campaigns/${campaignId}/characters`);
      expect(pendingList.body.characters).toHaveLength(0);

      await mj.post(`/campaigns/${campaignId}/characters/${sheetId}/accept`);
      const acceptedList = await mj.get(`/campaigns/${campaignId}/characters`);
      expect(acceptedList.body.characters).toHaveLength(1);
    });

    it("POST liaison (accept) sans cookie renvoie 401", async () => {
      const res = await request(app).post("/campaigns/whatever/characters/x/accept");
      expect(res.status).toBe(401);
    });
  });

  describe("Copie d'une fiche vers une autre campagne", () => {
    it("POST /character-sheets/:id/copy crée une nouvelle fiche PENDING dans la campagne cible (201)", async () => {
      const player = await authenticate(app, "player@test.com", "Joueur");
      const groupId = await createGroup(player);
      // Fiche source rattachée à une 1re campagne (MJ tiers).
      const { sheet } = await createPendingSheet(app, player, groupId, "Aragorn");
      // Une 2e campagne du même groupe (autre MJ tiers) sert de cible à la copie.
      const { campaignId: targetCampaignId } = await provisionCampaignWithMj(app, player, groupId);

      const res = await player
        .post(`/character-sheets/${sheet.id}/copy`)
        .send({ targetCampaignId });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Aragorn");
      expect(res.body.id).not.toBe(sheet.id);

      // La copie apparaît parmi mes fiches du groupe (2 fiches : la source + la copie).
      const list = await player.get(`/character-sheets?groupId=${groupId}`);
      expect(list.body.characterSheets).toHaveLength(2);

      // La copie pointe vers la campagne cible, en attente de validation.
      const campaigns = await player.get(`/character-sheets/${res.body.id}/campaigns`);
      expect(campaigns.body.campaigns[0].campaignId).toBe(targetCampaignId);
      expect(campaigns.body.campaigns[0].linkStatus).toBe("PENDING");
    });

    it("copier la fiche d'un autre (non-propriétaire) renvoie 403", async () => {
      const owner = await authenticate(app, "owner@test.com", "Owner");
      const groupId = await createGroup(owner);
      const { sheet } = await createPendingSheet(app, owner, groupId, "Privée");
      const { campaignId: targetCampaignId } = await provisionCampaignWithMj(app, owner, groupId);

      const mate = await authenticate(app, "mate@test.com", "Mate");
      await joinGroup(owner, groupId, mate, "mate@test.com");

      const res = await mate.post(`/character-sheets/${sheet.id}/copy`).send({ targetCampaignId });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
    });

    it("copier vers la propre campagne du copieur (il en est MJ) renvoie 409", async () => {
      // Le joueur est admin de son groupe et crée sa propre campagne cible (il en est donc MJ).
      const player = await authenticate(app, "player@test.com", "Joueur");
      const groupId = await createGroup(player);
      const { sheet } = await createPendingSheet(app, player, groupId, "Aragorn");
      const ownCampaignId = await createCampaign(player, groupId, "Sa campagne");

      const res = await player
        .post(`/character-sheets/${sheet.id}/copy`)
        .send({ targetCampaignId: ownCampaignId });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("GM_CANNOT_JOIN_OWN_CAMPAIGN");
    });

    it("copier vers une campagne inexistante renvoie 404", async () => {
      const player = await authenticate(app, "player@test.com", "Joueur");
      const groupId = await createGroup(player);
      const { sheet } = await createPendingSheet(app, player, groupId, "Aragorn");

      const res = await player
        .post(`/character-sheets/${sheet.id}/copy`)
        .send({ targetCampaignId: "campagne-inconnue" });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CAMPAIGN_NOT_FOUND");
    });

    it("POST /character-sheets/:id/copy sans cookie renvoie 401", async () => {
      const res = await request(app).post("/character-sheets/whatever/copy").send({});
      expect(res.status).toBe(401);
    });
  });
});
