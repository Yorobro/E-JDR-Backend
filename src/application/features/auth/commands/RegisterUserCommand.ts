/**
 * Commande d'entrée du use case d'inscription.
 *
 * Transporte les données brutes (non encore validées par le domaine) nécessaires
 * pour créer un compte. La validation de format est réalisée par les value objects
 * du domaine au sein du use case.
 */
export interface RegisterUserCommand {
  /** Adresse e-mail saisie par l'utilisateur (brute). */
  readonly email: string;
  /** Pseudo (nom d'affichage) saisi par l'utilisateur (brut). */
  readonly pseudo: string;
  /** Mot de passe en clair saisi par l'utilisateur (brut). */
  readonly password: string;
}
