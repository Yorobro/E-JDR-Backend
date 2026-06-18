import { AppError } from "@application/errors/AppError";

export class ReferenceHttpMapper {
  public static statusFor(error: AppError): number {
    switch (error.code) {
      case "INVALID_REFERENCE_NAME":
        return 400;
      case "REFERENCE_NAME_ALREADY_USED":
        return 409;
      case "REFERENCE_ITEM_NOT_FOUND":
      case "CHARACTER_SHEET_NOT_FOUND":
      case "GROUP_NOT_FOUND":
        return 404;
      case "CHARACTER_SHEET_ACCESS_DENIED":
      case "NOT_GROUP_MEMBER":
      case "NOT_GROUP_ADMIN":
        return 403;
      default:
        return 400;
    }
  }
}
