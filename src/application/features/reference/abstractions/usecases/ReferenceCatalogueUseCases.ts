import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ReferenceItemView } from "@application/features/reference/abstractions/usecases/ReferenceItemView";

/**
 * Commande de création d'un élément de référence (catégorie portée par l'instance du use case).
 *
 * Les champs `stat`/`bonus`/`competenceIds` sont **optionnels** et ne concernent que certains
 * types : `stat`/`bonus` pour les formations et peuples (bonus de statistique), `competenceIds`
 * pour les formations uniquement. Les autres types (armes, armures, …) les laissent absents.
 */
export interface CreateReferenceItemCommand {
  /** Identifiant du groupe propriétaire du catalogue (issu du corps de la requête). */
  readonly groupId: string;
  /** Identifiant de l'utilisateur qui agit (issu de la session). */
  readonly actorId: string;
  /** Nom saisi (brut, revalidé via `ReferenceName`). */
  readonly name: string;
  /**
   * Statistique ciblée par le bonus (formations/peuples). `undefined`/`null` ⇒ aucun bonus.
   * Revalidée via le value object `StatBonus`.
   */
  readonly stat?: string | null;
  /**
   * Montant du bonus (entier ≥ 1, défaut 1 si `stat` fournie sans montant). Ignoré si `stat`
   * est absente.
   */
  readonly bonus?: number | null;
  /**
   * Identifiants des compétences à rattacher à la formation (formations uniquement). Chaque
   * compétence doit exister dans le **même groupe**. Absent/vide ⇒ aucune compétence.
   */
  readonly competenceIds?: string[];
  /**
   * Points de protection (armures uniquement). Entier ≥ 0 ; une valeur négative est clampée à 0.
   * `undefined`/`null` ⇒ non renseigné (traité comme le défaut 0 à l'usage). Ignoré pour les
   * autres types.
   */
  readonly protectionPoints?: number | null;
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
