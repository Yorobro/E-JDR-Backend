import { AppError } from "@application/errors/AppError";

export class InvitationAlreadyPendingError extends AppError {
  constructor() {
    super("INVITATION_ALREADY_PENDING", "Une invitation est déjà en attente pour cet utilisateur.");
  }
}
