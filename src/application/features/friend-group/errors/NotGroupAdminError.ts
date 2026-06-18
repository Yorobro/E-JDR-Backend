import { AppError } from "@application/errors/AppError";

export class NotGroupAdminError extends AppError {
  constructor() {
    super("NOT_GROUP_ADMIN", "Vous n'êtes pas administrateur de ce groupe.");
  }
}
