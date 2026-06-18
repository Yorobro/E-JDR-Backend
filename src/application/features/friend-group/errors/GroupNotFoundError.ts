import { AppError } from "@application/errors/AppError";

export class GroupNotFoundError extends AppError {
  constructor() {
    super("GROUP_NOT_FOUND", "Groupe introuvable.");
  }
}
