/**
 * Commande du use case « le MJ valide ou refuse une demande de rattachement d'une fiche à sa
 * campagne ».
 *
 * `actorUserId` provient de la session authentifiée (jamais du corps). La décision est binaire :
 * `accept` valide le rattachement (PENDING → ACCEPTED), tout autre valeur le **refuse**, ce qui
 * **supprime** la fiche.
 */
export interface RespondToCampaignLinkRequestCommand {
  /** Identifiant de la campagne sur laquelle porte la demande. */
  readonly campaignId: string;
  /** Identifiant de la fiche dont le rattachement est en attente. */
  readonly characterSheetId: string;
  /** Identifiant du demandeur (doit être le MJ de la campagne). */
  readonly actorUserId: string;
  /** `true` pour accepter (ACCEPTED), `false` pour refuser (suppression de la fiche). */
  readonly accept: boolean;
}
