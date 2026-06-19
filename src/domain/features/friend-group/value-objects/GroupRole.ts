export class GroupRole {
  public static readonly ADMIN = new GroupRole("ADMIN");
  public static readonly MEMBER = new GroupRole("MEMBER");

  private constructor(public readonly value: string) {}

  public static create(raw: string): GroupRole {
    switch (raw) {
      case "ADMIN":
        return GroupRole.ADMIN;
      case "MEMBER":
        return GroupRole.MEMBER;
      default:
        throw new Error(`Rôle de groupe inconnu : ${raw}`);
    }
  }

  public isAdmin(): boolean {
    return this.value === "ADMIN";
  }

  public toString(): string {
    return this.value;
  }
}
