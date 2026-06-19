import { AppError } from "@application/errors/AppError";

export class InvitationNotFoundError extends AppError {
  constructor() {
    super("INVITATION_NOT_FOUND", "Invitation introuvable.");
  }
}
