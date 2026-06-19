import { AppError } from "@application/errors/AppError";

export class InvalidGroupNameError extends AppError {
  constructor(reason: string) {
    super("INVALID_GROUP_NAME", `Nom de groupe invalide : ${reason}`);
  }
}
