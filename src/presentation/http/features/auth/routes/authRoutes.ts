import { Router } from "express";
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";

/**
 * Construit le routeur Express des endpoints d'authentification.
 *
 * Le routeur ne fait que câbler les chemins HTTP aux méthodes du controller injecté ;
 * il ne contient aucune logique métier.
 *
 * @param controller - Le controller d'authentification dont les méthodes traitent les requêtes.
 * @returns Le routeur Express configuré, à monter sous `/auth`.
 */
export function buildAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/logout", controller.logout);

  return router;
}
