import { AppError } from "@application/errors/AppError";

export class CampaignHttpMapper {
  public static statusFor(error: AppError): number {
    switch (error.code) {
      case "INVALID_CAMPAIGN_NAME":
        return 400;
      case "CAMPAIGN_NOT_FOUND":
      case "GROUP_NOT_FOUND":
        return 404;
      case "CAMPAIGN_ACCESS_DENIED":
      case "NOT_GROUP_MEMBER":
      case "NOT_GROUP_ADMIN":
      case "NOT_GROUP_EDITOR":
        return 403;
      default:
        return 400;
    }
  }
}
