import { InvalidFriendGroupNameError } from "@domain/features/friend-group/errors/InvalidFriendGroupNameError";

export class FriendGroupName {
  private static readonly MAX_LENGTH = 120;

  private constructor(public readonly value: string) {}

  public static create(raw: string): FriendGroupName {
    if (typeof raw !== "string") {
      throw new InvalidFriendGroupNameError("valeur absente ou de type incorrect");
    }
    const normalized = raw.trim();
    if (normalized.length === 0) {
      throw new InvalidFriendGroupNameError("le nom ne peut pas être vide");
    }
    if (normalized.length > FriendGroupName.MAX_LENGTH) {
      throw new InvalidFriendGroupNameError(
        `le nom ne peut pas dépasser ${FriendGroupName.MAX_LENGTH} caractères`,
      );
    }
    return new FriendGroupName(normalized);
  }

  public equals(other: FriendGroupName): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
