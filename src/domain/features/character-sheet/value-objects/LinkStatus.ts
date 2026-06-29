import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Statut de rattachement d'une fiche à **sa** campagne (modèle « une fiche = une campagne »).
 *
 * - `PENDING` : la fiche a été créée par un joueur en choisissant une campagne, mais le maître
 *   du jeu n'a pas encore validé le rattachement.
 * - `ACCEPTED` : le maître du jeu a validé : la fiche participe réellement à la campagne.
 *
 * Le refus du MJ n'est pas un statut : il **supprime** la fiche (cf. RespondToCampaignLinkRequest).
 */
export class LinkStatus {
  public static readonly PENDING = new LinkStatus("PENDING");
  public static readonly ACCEPTED = new LinkStatus("ACCEPTED");

  private constructor(public readonly value: string) {}

  public static create(raw: string): LinkStatus {
    switch (raw) {
      case "PENDING":
        return LinkStatus.PENDING;
      case "ACCEPTED":
        return LinkStatus.ACCEPTED;
      default:
        throw new InvalidLinkStatusError(raw);
    }
  }

  public isPending(): boolean {
    return this.value === "PENDING";
  }

  public isAccepted(): boolean {
    return this.value === "ACCEPTED";
  }

  public toString(): string {
    return this.value;
  }
}

/** Erreur domaine levée quand une chaîne ne correspond à aucun statut de rattachement connu. */
export class InvalidLinkStatusError extends DomainError {
  constructor(raw: string) {
    super("INVALID_LINK_STATUS", `Statut de rattachement inconnu : ${raw}`);
  }
}
