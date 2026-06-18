import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";

export interface ReferenceRepository {
  save(item: ReferenceItem): Promise<void>;

  /** Liste les éléments d'un groupe (du plus récent au plus ancien). */
  findByGroupId(groupId: string): Promise<ReferenceItem[]>;

  findById(id: string): Promise<ReferenceItem | null>;

  /** Retourne `true` si le groupe possède déjà un élément du nom donné (unicité `group_id, name`). */
  existsByGroupAndName(groupId: string, name: string): Promise<boolean>;

  deleteById(id: string): Promise<void>;
}

export type FormationRepository = ReferenceRepository;
export type PeupleRepository = ReferenceRepository;
export type ArmeRepository = ReferenceRepository;
export type ArmureRepository = ReferenceRepository;
export type CompetenceRepository = ReferenceRepository;
export type EquipementRepository = ReferenceRepository;
