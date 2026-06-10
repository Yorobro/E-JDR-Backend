/**
 * Commande d'entrée du use case de rafraîchissement.
 *
 * Porte le refresh token courant à partir duquel une nouvelle paire de jetons sera émise
 * (avec rotation : l'ancien refresh token est révoqué).
 */
export interface RefreshAccessTokenCommand {
  /** Le refresh token brut courant (issu du cookie). */
  readonly refreshToken: string;
}


