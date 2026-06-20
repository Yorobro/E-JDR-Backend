/**
 * Commande d'entrée du use case de changement d'e-mail du compte connecté.
 *
 * Transporte les données brutes (non encore validées par le domaine) nécessaires
 * pour modifier l'adresse e-mail. La validation de format est réalisée par le value
 * object `Email` au sein du use case.
 */
export interface ChangeEmailCommand {
  /** Identifiant de l'utilisateur connecté (issu du jeton d'accès vérifié). */
  readonly userId: string;
  /** Nouvel e-mail saisi par l'utilisateur (brut, non encore validé). */
  readonly newEmail: string;
}
