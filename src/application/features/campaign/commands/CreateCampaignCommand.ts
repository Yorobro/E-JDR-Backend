export interface CreateCampaignCommand {
  /** Identifiant du groupe dans lequel créer la campagne (issu du corps de la requête). */
  readonly groupId: string;
  /** Identifiant du maître du jeu propriétaire (issu de la session authentifiée). */
  readonly gameMasterId: string;
  /** Nom de la campagne saisi par l'utilisateur (brut, non encore validé). */
  readonly name: string;
}
