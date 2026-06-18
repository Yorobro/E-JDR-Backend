import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ReferenceItemView } from "@application/features/reference/abstractions/usecases/ReferenceItemView";

/** Commande de création d'un élément de référence (catégorie portée par l'instance du use case). */
export interface CreateReferenceItemCommand {
  /** Identifiant du groupe propriétaire du catalogue (issu du corps de la requête). */
  readonly groupId: string;
  /** Identifiant de l'utilisateur qui agit (issu de la session). */
  readonly actorId: string;
  /** Nom saisi (brut, revalidé via `ReferenceName`). */
  readonly name: string;
}

/** Requête de listing des éléments d'un groupe. */
export interface ListReferenceItemsQuery {
  /** Identifiant du groupe (issu du paramètre de requête HTTP). */
  readonly groupId: string;
  /** Identifiant de l'utilisateur courant (pour vérifier son appartenance au groupe). */
  readonly actorId: string;
}

/** Commande de suppression d'un élément de référence. */
export interface DeleteReferenceItemCommand {
  /** Identifiant de l'élément à supprimer. */
  readonly itemId: string;
  /** Identifiant de l'utilisateur qui agit (issu de la session). */
  readonly actorId: string;
}

export interface CreateReferenceItemUseCase {
  execute(command: CreateReferenceItemCommand): Promise<Result<ReferenceItemView, AppError>>;
}

export interface ListReferenceItemsUseCase {
  execute(query: ListReferenceItemsQuery): Promise<Result<ReferenceItemView[], AppError>>;
}

export interface DeleteReferenceItemUseCase {
  execute(command: DeleteReferenceItemCommand): Promise<Result<void, AppError>>;
}
