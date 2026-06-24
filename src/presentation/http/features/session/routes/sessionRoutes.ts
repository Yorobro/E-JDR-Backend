import { Router } from "express";
import { SessionController } from "@presentation/http/features/session/controllers/SessionController";

/**
 * Routeur des sessions imbriquées sous une campagne, à monter sous `/campaigns`.
 *
 * Cohabite avec le routeur campaign (Express cumule les routeurs montés sur un même préfixe).
 * Le middleware d'authentification est monté en amont (dans `buildHttpApp`), pas ici.
 *
 * @param controller - Le controller session.
 * @returns Le routeur Express, à monter sous `/campaigns`.
 */
export function buildCampaignSessionRoutes(controller: SessionController): Router {
  const router = Router();

  router.post("/:campaignId/sessions", controller.create);
  router.get("/:campaignId/sessions", controller.list);

  return router;
}

/**
 * Routeur des sessions par identifiant, à monter sous `/sessions`.
 *
 * Sépare les opérations « par id » (détail, mise à jour, suppression) des routes imbriquées
 * sous la campagne, à l'image de l'organisation des fiches de personnage.
 *
 * @param controller - Le controller session.
 * @returns Le routeur Express, à monter sous `/sessions`.
 */
export function buildSessionByIdRoutes(controller: SessionController): Router {
  const router = Router();

  router.get("/:id", controller.get);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.remove);
  router.post("/:id/launch", controller.launch);

  return router;
}
