import { Router } from "express";
import { CharacterSheetExportController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetExportController";

/**
 * Construit le routeur Express de l'export PDF des fiches (protégé).
 *
 * Routeur dédié, monté en parallèle de `buildCharacterSheetRoutes` sous `/character-sheets`.
 * Le middleware d'authentification est monté en amont (dans `buildHttpApp`).
 *
 * @param controller - Le controller d'export PDF des fiches.
 * @returns Le routeur à monter sous `/character-sheets`.
 */
export function buildCharacterSheetExportRoutes(
  controller: CharacterSheetExportController,
): Router {
  const router = Router();

  router.get("/:id/export-pdf", controller.exportPdf);

  return router;
}
