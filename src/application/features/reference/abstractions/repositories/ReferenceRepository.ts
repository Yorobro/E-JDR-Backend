import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";

export interface ReferenceRepository {
  save(item: ReferenceItem): Promise<void>;

  /**
   * Met à jour un élément **existant** (identifié par `item.id`). Remplace les champs mutables
   * (nom, bonus de statistique, points de protection) ; `id`/`group_id`/`created_at` restent
   * immuables. À appeler dans une transaction (écriture).
   */
  update(item: ReferenceItem): Promise<void>;

  /** Liste les éléments d'un groupe (du plus récent au plus ancien). */
  findByGroupId(groupId: string): Promise<ReferenceItem[]>;

  findById(id: string): Promise<ReferenceItem | null>;

  /** Retourne `true` si le groupe possède déjà un élément du nom donné (unicité `group_id, name`). */
  existsByGroupAndName(groupId: string, name: string): Promise<boolean>;

  /**
   * Retourne `true` si l'élément d'identifiant `itemId` existe **et** appartient au groupe donné.
   *
   * Utilisé pour valider qu'une compétence référencée par une formation appartient bien au même
   * groupe que la formation (sécurité de portée + intégrité du lien `formation_competences`).
   *
   * @param groupId - Identifiant du groupe attendu.
   * @param itemId - Identifiant de l'élément à vérifier.
   */
  existsInGroup(groupId: string, itemId: string): Promise<boolean>;

  deleteById(id: string): Promise<void>;
}

export type FormationRepository = ReferenceRepository;
export type PeupleRepository = ReferenceRepository;
export type ArmeRepository = ReferenceRepository;
export type ArmureRepository = ReferenceRepository;
export type CompetenceRepository = ReferenceRepository;
export type EquipementRepository = ReferenceRepository;
