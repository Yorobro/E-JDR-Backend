import { Router } from "express";
import { InvitationController } from "@presentation/http/features/friend-group/controllers/InvitationController";

export function buildInvitationRoutes(invitationController: InvitationController): Router {
  const router = Router();

  router.get("/", invitationController.listMine);
  router.post("/:id/accept", invitationController.accept);
  router.post("/:id/decline", invitationController.decline);

  return router;
}
