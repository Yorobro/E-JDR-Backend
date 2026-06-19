import { AppError } from "@application/errors/AppError";

export class GroupHasResourcesError extends AppError {
  constructor() {
    super(
      "GROUP_HAS_RESOURCES",
      "Impossible de supprimer ce groupe : il contient encore des campagnes ou des fiches.",
    );
  }
}
