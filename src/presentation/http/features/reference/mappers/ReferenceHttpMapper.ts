import { AppError } from "@application/errors/AppError";

/**
 * Mappe les erreurs applicatives de la feature référence vers des statuts HTTP. Confine ici la
 * connaissance du transport. Réutilise aussi les codes fiche (la liaison vérifie la propriété de
 * la fiche). Toutes les méthodes sont statiques.
 */
export class ReferenceHttpMapper {
  /**
   * Traduit un `AppError` en statut HTTP.
   *
   * @param error - L'erreur applicative retournée par le use case.
   * @returns Le statut HTTP correspondant.
   */
  public static statusFor(error: AppError): number {
    switch (error.code) {
      case "INVALID_REFERENCE_NAME":
        return 400;
      case "REFERENCE_NAME_ALREADY_USED":
        return 409;
      case "REFERENCE_ITEM_NOT_FOUND":
      case "CHARACTER_SHEET_NOT_FOUND":
        return 404;
      case "CHARACTER_SHEET_ACCESS_DENIED":
        return 403;
      default:
        return 400;
    }
  }
}
