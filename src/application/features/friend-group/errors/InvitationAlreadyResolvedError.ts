import { AppError } from "@application/errors/AppError";

export class InvitationAlreadyResolvedError extends AppError {
  constructor() {
    super("INVITATION_ALREADY_RESOLVED", "Cette invitation a déjà été acceptée ou refusée.");
  }
}
