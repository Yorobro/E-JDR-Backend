import { AppError } from "@application/errors/AppError";

export class CannotRemoveLastAdminError extends AppError {
  constructor() {
    super(
      "CANNOT_REMOVE_LAST_ADMIN",
      "Impossible de retirer ou rétrograder le dernier administrateur du groupe.",
    );
  }
}
