import { DomainError } from "@domain/shared/errors/DomainError";

export class InvalidFriendGroupNameError extends DomainError {
  constructor(reason: string) {
    super("INVALID_FRIEND_GROUP_NAME", `Nom de groupe invalide : ${reason}`);
  }
}
