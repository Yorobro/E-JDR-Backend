import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ReferenceItemView } from "@application/features/reference/abstractions/usecases/ReferenceItemView";

/** Commande de rattachement d'un élément de référence à une fiche. */
export interface LinkSheetReferenceCommand {
  /** Identifiant de la fiche. */
  readonly sheetId: string;
  /** Identifiant de l'élément de référence à rattacher. */
  readonly itemId: string;
  /** Identifiant du demandeur (issu de la session) : doit posséder la fiche ET l'élément. */
  readonly actorUserId: string;
}

/** Commande de détachement d'un élément de référence d'une fiche. */
export interface UnlinkSheetReferenceCommand {
  /** Identifiant de la fiche. */
  readonly sheetId: string;
  /** Identifiant de l'élément à détacher. */
  readonly itemId: string;
  /** Identifiant du demandeur (issu de la session). */
  readonly actorUserId: string;
}

/** Requête de listing des éléments rattachés à une fiche. */
export interface ListSheetReferencesQuery {
  /** Identifiant de la fiche. */
  readonly sheetId: string;
  /** Identifiant du demandeur (issu de la session) : doit posséder la fiche. */
  readonly actorUserId: string;
}

/** Port « in » : rattacher un élément de référence à une fiche (N‑N). */
export interface LinkSheetReferenceUseCase {
  execute(command: LinkSheetReferenceCommand): Promise<Result<void, AppError>>;
}

/** Port « in » : détacher un élément de référence d'une fiche (N‑N). */
export interface UnlinkSheetReferenceUseCase {
  execute(command: UnlinkSheetReferenceCommand): Promise<Result<void, AppError>>;
}

/** Port « in » : lister les éléments rattachés à une fiche (N‑N). */
export interface ListSheetReferencesUseCase {
  execute(query: ListSheetReferencesQuery): Promise<Result<ReferenceItemView[], AppError>>;
}
