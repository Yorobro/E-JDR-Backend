import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";

/**
 * Port « out » générique d'accès à un **catalogue d'éléments de référence** (une table).
 *
 * La couche application dépend de cette interface ; l'implémentation MySQL (paramétrée par table)
 * vit dans l'infrastructure. Chaque catégorie (formation, peuple, arme, armure, compétence,
 * équipement) a son propre repository, distingué par un **type marqueur** (sous-interface vide)
 * pour que la DI/UoW injecte le bon, tout en partageant ce contrat unique.
 */
export interface ReferenceRepository {
  /**
   * Persiste un nouvel élément de référence.
   *
   * @param item - L'élément à enregistrer.
   */
  save(item: ReferenceItem): Promise<void>;

  /**
   * Liste les éléments d'un propriétaire (du plus récent au plus ancien).
   *
   * @param ownerId - Identifiant du propriétaire.
   * @returns Ses éléments (vide si aucun).
   */
  findByOwnerId(ownerId: string): Promise<ReferenceItem[]>;

  /**
   * Récupère un élément par son identifiant.
   *
   * @param id - L'identifiant de l'élément.
   * @returns L'élément, ou `null` si aucun ne correspond.
   */
  findById(id: string): Promise<ReferenceItem | null>;

  /**
   * Indique si le propriétaire possède déjà un élément du nom donné (unicité `owner_id, name`).
   *
   * @param ownerId - Identifiant du propriétaire.
   * @param name - Nom normalisé à tester.
   * @returns `true` si un homonyme existe déjà pour ce propriétaire.
   */
  existsByOwnerAndName(ownerId: string, name: string): Promise<boolean>;

  /**
   * Supprime un élément par son identifiant (idempotent).
   *
   * @param id - L'identifiant de l'élément à supprimer.
   */
  deleteById(id: string): Promise<void>;
}

/** Repository des **formations** (catalogue N‑1 référencé par `character_sheets.formation_id`). */
export type FormationRepository = ReferenceRepository;
/** Repository des **peuples** (catalogue N‑1 référencé par `character_sheets.peuple_id`). */
export type PeupleRepository = ReferenceRepository;
/** Repository des **armes** (catalogue N‑N lié aux fiches via `sheet_armes`). */
export type ArmeRepository = ReferenceRepository;
/** Repository des **armures** (catalogue N‑N lié aux fiches via `sheet_armures`). */
export type ArmureRepository = ReferenceRepository;
/** Repository des **compétences** (catalogue N‑N lié aux fiches via `sheet_competences`). */
export type CompetenceRepository = ReferenceRepository;
/** Repository des **équipements** (catalogue N‑N lié aux fiches via `sheet_equipements`). */
export type EquipementRepository = ReferenceRepository;
