import { AppError } from "@application/errors/AppError";

export class GroupHttpMapper {
  public static statusFor(error: AppError): number {
    switch (error.code) {
      case "INVALID_GROUP_NAME":
        return 400;
      case "INVITED_USER_NOT_FOUND":
        return 404;
      case "GROUP_NOT_FOUND":
        return 404;
      case "INVITATION_NOT_FOUND":
        return 404;
      case "NOT_GROUP_MEMBER":
        return 403;
      case "NOT_GROUP_ADMIN":
        return 403;
      case "ALREADY_MEMBER":
        return 409;
      case "INVITATION_ALREADY_RESOLVED":
        return 409;
      case "CANNOT_REMOVE_LAST_ADMIN":
        return 409;
      default:
        return 400;
    }
  }
}
