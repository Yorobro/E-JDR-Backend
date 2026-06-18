import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ReferenceItemView } from "@application/features/reference/abstractions/usecases/ReferenceItemView";

/** Commande de création d'un élément de référence (catégorie portée par l'instance du use case). */
export interface CreateReferenceItemCommand {
  /** Identifiant du propriétaire (issu de la session). */
  readonly ownerId: string;
  /** Nom saisi (brut, revalidé via `ReferenceName`). */
  readonly name: string;
}

/** Requête de listing des éléments d'un propriétaire. */
export interface ListReferenceItemsQuery {
  /** Identifiant du propriétaire (issu de la session). */
  readonly ownerId: string;
}

/** Commande de suppression d'un élément de référence. */
export interface DeleteReferenceItemCommand {
  /** Identifiant de l'élément à supprimer. */
  readonly itemId: string;
  /** Identifiant du demandeur (issu de la session). */
  readonly ownerId: string;
}

/** Port « in » : créer un élément de référence (catalogue d'un type donné). */
export interface CreateReferenceItemUseCase {
  execute(command: CreateReferenceItemCommand): Promise<Result<ReferenceItemView, AppError>>;
}

/** Port « in » : lister mes éléments de référence (catalogue d'un type donné). */
export interface ListReferenceItemsUseCase {
  execute(query: ListReferenceItemsQuery): Promise<Result<ReferenceItemView[], AppError>>;
}

/** Port « in » : supprimer un de mes éléments de référence. */
export interface DeleteReferenceItemUseCase {
  execute(command: DeleteReferenceItemCommand): Promise<Result<void, AppError>>;
}
