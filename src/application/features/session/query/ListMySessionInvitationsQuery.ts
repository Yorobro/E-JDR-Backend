/**
 * Requête de lecture « lister mes invitations de session en attente ».
 *
 * L'`actorUserId` provient de l'utilisateur authentifié : on ne retourne que les invitations
 * qui le concernent (participations au statut `INVITED`).
 */
export interface ListMySessionInvitationsQuery {
  /** Identifiant de l'utilisateur demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
}
