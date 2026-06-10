/**
 * Classe de base abstraite de toutes les erreurs **applicatives** (couche application).
 *
 * Une `AppError` représente un échec métier **attendu** survenant lors de l'orchestration
 * d'un use case (ex : e-mail déjà utilisé, identifiants invalides). Elle est destinée à être
 * transportée dans un `Result` (et non levée comme exception).
 *
 * Chaque erreur applicative concrète fournit un `code` symbolique stable, que la couche
 * présentation peut traduire en code HTTP.
 */
export abstract class AppError {
  /**
   * Code symbolique stable identifiant le type d'erreur (ex : `"EMAIL_ALREADY_USED"`).
   */
  public readonly code: string;

  /**
   * Message lisible décrivant l'échec métier.
   */
  public readonly message: string;

  /**
   * @param code - Identifiant symbolique stable de l'erreur.
   * @param message - Message lisible décrivant l'échec.
   */
  protected constructor(code: string, message: string) {
    this.code = code;
    this.message = message;
  }
}

