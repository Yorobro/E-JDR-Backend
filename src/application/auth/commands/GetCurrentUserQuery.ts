/**
 * Données d'entrée du use case de consultation du profil courant.
 *
 * Le `userId` provient des claims du jeton d'accès vérifié par le middleware
 * d'authentification — jamais du corps de la requête.
 */
export interface GetCurrentUserQuery {
  /** Identifiant de l'utilisateur authentifié. */
  readonly userId: string;
}
