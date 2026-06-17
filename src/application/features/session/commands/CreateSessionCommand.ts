/**
 * Commande d'entrée du use case de création de session.
 *
 * Transporte les données brutes nécessaires. L'`actorUserId` provient de l'utilisateur
 * authentifié (jamais du corps de la requête) ; il sert à vérifier que le demandeur est le
 * maître du jeu de la campagne parente. Le `title` est validé par le value object
 * `SessionTitle` du domaine, et la `date` est parsée par le use case.
 */
export interface CreateSessionCommand {
  /** Identifiant de la campagne parente (issu de l'URL). */
  readonly campaignId: string;
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
  /** Titre de la session saisi par l'utilisateur (brut, non encore validé). */
  readonly title: string;
  /** Date de la session au format `YYYY-MM-DD` (brute, parsée par le use case). */
  readonly date: string;
}
