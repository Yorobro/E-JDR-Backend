/**
 * Commande d'entrée du use case de déconnexion.
 *
 * Porte le refresh token à révoquer. La déconnexion consiste à supprimer ce token
 * côté serveur, rendant la session inutilisable même si le cookie subsiste côté client.
 */
export interface LogoutUserCommand {
  /** Le refresh token brut (issu du cookie) à révoquer. */
  readonly refreshToken: string;
}
