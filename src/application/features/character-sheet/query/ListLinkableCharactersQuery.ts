/**
 * Requête de lecture du use case « lister les fiches rattachables à une campagne ».
 *
 * `actorUserId` provient de la session : il doit être le MJ de la campagne. La liste retournée
 * exclut les fiches du MJ et celles déjà rattachées à la campagne.
 */
export interface ListLinkableCharactersQuery {
  /** Identifiant de la campagne dont on cherche les fiches rattachables. */
  readonly campaignId: string;
  /** Identifiant du demandeur (issu de la session) ; doit être le MJ de la campagne. */
  readonly actorUserId: string;
}
