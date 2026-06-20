import { Router } from "express";
import { UserController } from "@presentation/http/features/auth/controllers/UserController";

/**
 * Construit le routeur Express des endpoints utilisateur protégés.
 *
 * Le middleware d'authentification est monté en amont (dans `buildHttpApp`), pas ici :
 * le routeur ne fait que câbler les chemins aux méthodes du controller.
 *
 * @param controller - Le controller utilisateur dont les méthodes traitent les requêtes.
 * @returns Le routeur Express configuré, à monter sous `/me`.
 */
export function buildUserRoutes(controller: UserController): Router {
  const router = Router();

  router.get("/", controller.me);
  router.patch("/email", controller.patchEmail);
  router.patch("/password", controller.patchPassword);

  return router;
}
