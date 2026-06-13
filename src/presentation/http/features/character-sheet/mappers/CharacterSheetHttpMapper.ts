import { AppError } from "@application/errors/AppError";

/**
 * Mappe les erreurs applicatives des fiches (et de leur liaison aux campagnes) vers des
 * statuts HTTP. Le mapper ne connaît pas le domaine, seulement les codes d'erreur applicatifs.
 */
export class CharacterSheetHttpMapper {
  /**
   * Traduit un `AppError` en statut HTTP.
   *
   * @param error - L'erreur applicative retournée par le use case.
   * @returns Le statut HTTP correspondant.
   */
  public static statusFor(error: AppError): number {
    switch (error.code) {
      case "INVALID_CHARACTER_SHEET_NAME":
        return 400;
      case "CHARACTER_SHEET_NOT_FOUND":
      case "CAMPAIGN_NOT_FOUND":
        return 404;
      case "CHARACTER_SHEET_ACCESS_DENIED":
        return 403;
      case "GM_CANNOT_JOIN_OWN_CAMPAIGN":
      case "SHEET_ALREADY_IN_CAMPAIGN":
        return 409;
      default:
        return 400;
    }
  }
}
