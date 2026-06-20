/**
 * Commande d'entrée du use case de changement de mot de passe du compte connecté.
 *
 * Transporte les données brutes (non encore validées par le domaine) nécessaires
 * pour modifier le mot de passe. La validation de robustesse est réalisée par le
 * value object `PlainPassword` au sein du use case.
 */
export interface ChangePasswordCommand {
  /** Identifiant de l'utilisateur connecté (issu du jeton d'accès vérifié). */
  readonly userId: string;
  /** Mot de passe actuel en clair (pour vérification avant modification). */
  readonly currentPassword: string;
  /** Nouveau mot de passe désiré (brut, non encore validé). */
  readonly newPassword: string;
}
