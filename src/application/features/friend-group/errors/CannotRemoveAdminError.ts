import { AppError } from "@application/errors/AppError";

export class CannotRemoveAdminError extends AppError {
  constructor() {
    super(
      "CANNOT_REMOVE_ADMIN",
      "Un administrateur ne peut pas retirer un autre administrateur du groupe.",
    );
  }
}
