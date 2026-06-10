/**
 * Commande d'entrée du use case de connexion.
 *
 * Transporte les identifiants bruts soumis lors de la tentative de connexion.
 */
export interface LoginUserCommand {
  /** Adresse e-mail saisie (brute). */
  readonly email: string;
  /** Mot de passe en clair saisi (brut). */
  readonly password: string;
}
