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
  /**
   * Description libre (sorts/miracles uniquement). Texte brut, aucune contrainte. `undefined`/`null`
   * ⇒ non renseignée. Ignorée pour les autres types.
   */
  readonly description?: string | null;
}

/** Requête de listing des éléments d'un groupe. */
export interface ListReferenceItemsQuery {
  /** Identifiant du groupe (issu du paramètre de requête HTTP). */
  readonly groupId: string;
  /** Identifiant de l'utilisateur courant (pour vérifier son appartenance au groupe). */
  readonly actorId: string;
}

/**
 * Commande de **modification** d'un élément de référence (remplacement complet de son état).
 *
 * Le type ne change pas (porté par l'instance du use case / l'endpoint). Comme pour la création,
 * `stat`/`bonus` ne concernent que les formations et peuples, `competenceIds` les formations,
 * `protectionPoints` les armures ; les autres champs sont ignorés selon le type.
 *
 * Sémantique de **remplacement complet** : les champs absents sont traités comme « remis à zéro »
 * (ex : `stat` absente ⇒ plus de bonus ; `competenceIds` absent/vide ⇒ plus aucune compétence).
 */
export interface UpdateReferenceItemCommand {
  /** Identifiant de l'élément à modifier. */
  readonly itemId: string;
  /** Identifiant de l'utilisateur qui agit (issu de la session). */
  readonly actorId: string;
  /** Identifiant du groupe propriétaire (issu du corps de la requête, validé contre l'élément). */
  readonly groupId: string;
  /** Nouveau nom (brut, revalidé via `ReferenceName`). */
  readonly name: string;
  /** Nouvelle statistique ciblée par le bonus (formations/peuples). `undefined`/`null` ⇒ plus de bonus. */
  readonly stat?: string | null;
  /** Nouveau montant du bonus (entier ≥ 1, défaut 1 si `stat` fournie). Ignoré si `stat` absente. */
  readonly bonus?: number | null;
  /**
   * Nouvelle liste **complète** des compétences rattachées (formations uniquement). Remplace
   * entièrement les liens existants. Absent/vide ⇒ aucune compétence.
   */
  readonly competenceIds?: string[];
  /** Nouveaux points de protection (armures uniquement). `undefined`/`null` ⇒ non renseigné. */
  readonly protectionPoints?: number | null;
  /** Nouvelle description libre (sorts/miracles uniquement). `undefined`/`null` ⇒ non renseignée. */
  readonly description?: string | null;
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

export interface UpdateReferenceItemUseCase {
  execute(command: UpdateReferenceItemCommand): Promise<Result<ReferenceItemView, AppError>>;
}

export interface DeleteReferenceItemUseCase {
  execute(command: DeleteReferenceItemCommand): Promise<Result<void, AppError>>;
}
