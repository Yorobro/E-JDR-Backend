import { AppError } from "@application/errors/AppError";

export class AlreadyMemberError extends AppError {
  constructor() {
    super("ALREADY_MEMBER", "Cet utilisateur est déjà membre du groupe.");
  }
}
