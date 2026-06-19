import { Router } from "express";
import { ReferenceController } from "@presentation/http/features/reference/controllers/ReferenceController";

/**
 * Routeur du **catalogue** des éléments de référence, à monter sous `/reference`.
 * `:type` ∈ formations|peoples|armes|armures|competences|equipements (validé par le controller).
 *
 * @param controller - Le controller référence générique.
 * @returns Le routeur Express, à monter sous `/reference`.
 */
export function buildReferenceCatalogueRoutes(controller: ReferenceController): Router {
  const router = Router();
  router.post("/:type", controller.create);
  router.get("/:type", controller.list);
  router.put("/:type/:id", controller.update);
  router.delete("/:type/:id", controller.remove);
  return router;
}

/**
 * Routeur des **liaisons N‑N** fiche ↔ éléments, à monter sous `/character-sheets`.
 * `:type` ∈ armes|armures|competences|equipements (validé par le controller).
 *
 * Cohabite avec les autres routeurs montés sur `/character-sheets` (Express les cumule).
 *
 * @param controller - Le controller référence générique.
 * @returns Le routeur Express, à monter sous `/character-sheets`.
 */
export function buildSheetReferenceLinkRoutes(controller: ReferenceController): Router {
  const router = Router();
  router.post("/:id/:type", controller.link);
  router.get("/:id/:type", controller.listLinked);
  router.delete("/:id/:type/:itemId", controller.unlink);
  return router;
}
