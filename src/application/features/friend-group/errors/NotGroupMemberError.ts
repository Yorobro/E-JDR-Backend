import { AppError } from "@application/errors/AppError";

export class NotGroupMemberError extends AppError {
  constructor() {
    super("NOT_GROUP_MEMBER", "Vous n'êtes pas membre de ce groupe.");
  }
}
