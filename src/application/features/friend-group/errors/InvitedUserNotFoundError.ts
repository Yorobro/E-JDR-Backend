import { AppError } from "@application/errors/AppError";

export class InvitedUserNotFoundError extends AppError {
  constructor() {
    super("INVITED_USER_NOT_FOUND", "Aucun utilisateur trouvé avec cet e-mail.");
  }
}
