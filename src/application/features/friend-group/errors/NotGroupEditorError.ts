import { AppError } from "@application/errors/AppError";

export class NotGroupEditorError extends AppError {
  constructor() {
    super("NOT_GROUP_EDITOR", "Seuls les administrateurs et les MJ peuvent modifier ce contenu.");
  }
}
