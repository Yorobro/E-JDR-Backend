import { Router } from "express";
import { CharacterSheetController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetController";

/**
 * Construit le routeur Express des endpoints fiches (protégés).
 *
 * Le middleware d'authentification est monté en amont (dans `buildHttpApp`).
 *
 * @param controller - Le controller fiches.
 * @returns Le routeur à monter sous `/character-sheets`.
 */
export function buildCharacterSheetRoutes(controller: CharacterSheetController): Router {
  const router = Router();

  router.post("/", controller.create);
  router.post("/:id/copy", controller.copy);
  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.get("/:id/campaigns", controller.campaigns);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.remove);

  return router;
}
