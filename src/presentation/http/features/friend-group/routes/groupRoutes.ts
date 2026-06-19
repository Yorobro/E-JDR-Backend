import { Router } from "express";
import { GroupController } from "@presentation/http/features/friend-group/controllers/GroupController";
import { InvitationController } from "@presentation/http/features/friend-group/controllers/InvitationController";

export function buildGroupRoutes(
  groupController: GroupController,
  invitationController: InvitationController,
): Router {
  const router = Router();

  router.post("/", groupController.create);
  router.get("/", groupController.list);
  router.get("/:id", groupController.get);
  router.delete("/:id", groupController.remove);
  router.delete("/:id/members/:userId", groupController.removeMemberHandler);
  router.patch("/:id/members/:userId", groupController.changeRole);
  router.post("/:id/invitations", invitationController.invite);

  return router;
}
