import { Router } from "express";
import { CampaignController } from "@presentation/http/features/campaign/controllers/CampaignController";
import { CampaignCharacterController } from "@presentation/http/features/campaign/controllers/CampaignCharacterController";

/**
 * Construit le routeur Express des endpoints campaign (protégés), y compris la liaison
 * campagne↔fiches sous `/campaigns/:campaignId/characters`.
 *
 * Le middleware d'authentification est monté en amont (dans `buildHttpApp`), pas ici :
 * le routeur ne fait que câbler les chemins aux méthodes des controllers.
 *
 * @param controller - Le controller campaign (CRUD campagnes).
 * @param characterController - Le controller de la liaison campagne↔fiches.
 * @returns Le routeur Express configuré, à monter sous `/campaigns`.
 */
export function buildCampaignRoutes(
  controller: CampaignController,
  characterController: CampaignCharacterController,
): Router {
  const router = Router();

  router.post("/", controller.create);
  router.get("/", controller.list);
  router.delete("/:id", controller.remove);

  // Personnages d'une campagne (modèle « une fiche = une campagne »).
  router.get("/:campaignId/characters", characterController.list);
  router.get("/:campaignId/pending-characters", characterController.listPending);
  router.post("/:campaignId/characters/:characterSheetId/accept", characterController.accept);
  router.post("/:campaignId/characters/:characterSheetId/refuse", characterController.refuse);

  return router;
}
