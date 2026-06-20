import { InvalidGroupRoleError } from "@domain/features/friend-group/errors/InvalidGroupRoleError";

export class GroupRole {
  public static readonly ADMIN = new GroupRole("ADMIN");
  public static readonly MJ = new GroupRole("MJ");
  public static readonly MEMBER = new GroupRole("MEMBER");

  private constructor(public readonly value: string) {}

  public static create(raw: string): GroupRole {
    switch (raw) {
      case "ADMIN":
        return GroupRole.ADMIN;
      case "MJ":
        return GroupRole.MJ;
      case "MEMBER":
        return GroupRole.MEMBER;
      default:
        throw new InvalidGroupRoleError(raw);
    }
  }

  public isAdmin(): boolean {
    return this.value === "ADMIN";
  }

  /** Éditeur de contenu du groupe : ADMIN ou MJ (par opposition au MEMBER en lecture seule). */
  public isEditor(): boolean {
    return this.value === "ADMIN" || this.value === "MJ";
  }

  public toString(): string {
    return this.value;
  }
}
