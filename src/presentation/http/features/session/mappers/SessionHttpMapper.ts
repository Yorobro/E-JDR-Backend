import { AppError } from "@application/errors/AppError";

/**
 * Mappe les erreurs applicatives de la feature session vers des statuts HTTP.
 *
 * Confine ici la connaissance du transport (codes HTTP), afin que le controller reste centré
 * sur l'orchestration. Le mapper ne connaît pas le domaine, seulement les codes d'erreur
 * applicatifs (`AppError.code`). Toutes les méthodes sont statiques.
 */
export class SessionHttpMapper {
  /**
   * Traduit un `AppError` en statut HTTP.
   *
   * @param error - L'erreur applicative retournée par le use case.
   * @returns Le statut HTTP correspondant.
   */
  public static statusFor(error: AppError): number {
    switch (error.code) {
      case "INVALID_SESSION_TITLE":
      case "INVALID_SESSION_DATE":
      case "EMPTY_PARTICIPANT_SELECTION":
      case "PARTICIPANT_NOT_IN_GROUP":
        return 400;
      case "SESSION_NOT_FOUND":
      case "CAMPAIGN_NOT_FOUND":
        return 404;
      case "CAMPAIGN_ACCESS_DENIED":
      case "NOT_GROUP_EDITOR":
      case "NOT_GROUP_MEMBER":
        return 403;
      case "SESSION_NOT_LAUNCHABLE":
      case "SESSION_NOT_STARTABLE":
        // Conflit d'état : la session n'est pas dans le bon statut pour cette transition.
        return 409;
      default:
        // Code applicatif inattendu : on reste prudent avec un 400 (entrée invalide)
        // plutôt qu'un 500, les erreurs techniques passant par le middleware d'erreurs.
        return 400;
    }
  }
}
