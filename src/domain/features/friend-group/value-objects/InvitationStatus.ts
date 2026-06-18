export class InvitationStatus {
  public static readonly PENDING = new InvitationStatus("PENDING");
  public static readonly ACCEPTED = new InvitationStatus("ACCEPTED");
  public static readonly DECLINED = new InvitationStatus("DECLINED");

  private constructor(public readonly value: string) {}

  public static create(raw: string): InvitationStatus {
    switch (raw) {
      case "PENDING":
        return InvitationStatus.PENDING;
      case "ACCEPTED":
        return InvitationStatus.ACCEPTED;
      case "DECLINED":
        return InvitationStatus.DECLINED;
      default:
        throw new Error(`Statut d'invitation inconnu : ${raw}`);
    }
  }

  public isPending(): boolean {
    return this.value === "PENDING";
  }

  public isResolved(): boolean {
    return this.value !== "PENDING";
  }

  public toString(): string {
    return this.value;
  }
}
