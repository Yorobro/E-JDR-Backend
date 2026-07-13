import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { StatBonus } from "@domain/features/reference/value-objects/StatBonus";

import { TransactionalRepositories } from "@application/shared/UnitOfWork";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";
import { ReferenceItemView } from "@application/features/reference/abstractions/usecases/ReferenceItemView";

/** Sélectionne dans `TransactionalRepositories` le repository de la catégorie gérée. */
export type RepoSelector = (repos: TransactionalRepositories) => ReferenceRepository;

/**
 * Dépendances **spécifiques aux formations** pour la création : le catalogue de compétences (pour
 * vérifier que chaque compétence référencée appartient au même groupe) et la liaison N‑N
 * formation ↔ compétences (pour poser les liens). Absentes pour les autres types.
 */
export interface FormationCreateDeps {
  /** Catalogue de compétences du groupe (lecture : vérification de portée). */
  readonly competences: ReferenceRepository;
  /** Liaison transactionnelle formation ↔ compétences (sélection dans l'UoW). */
  readonly formationCompetences: (
    repos: TransactionalRepositories,
  ) => FormationCompetenceLinkRepository;
}

/**
 * Dépendances **spécifiques aux formations** pour la lecture : la liaison formation ↔ compétences
 * (lecture pure) afin de renseigner `competenceIds` dans la vue. Absente pour les autres types.
 */
export interface FormationListDeps {
  /** Liaison formation ↔ compétences (lecture pure). */
  readonly formationCompetences: FormationCompetenceLinkRepository;
}

/**
 * Construit le bonus de statistique à partir d'une stat/bonus bruts, ou `null` si aucune stat
 * fournie. Partagé par la création et la modification. **Formations uniquement** : les peuples
 * portent une liste de bonus (voir `buildStatBonuses`).
 *
 * @param stat - La statistique ciblée (`undefined`/`null` ⇒ aucun bonus).
 * @param bonus - Le montant du bonus (défaut 1 si `stat` fournie sans montant).
 * @returns Le `StatBonus` validé, ou `null` (pas de bonus).
 * @throws {DomainError} Si la stat ou le montant sont invalides (capté par l'appelant).
 */
export function buildStatBonus(
  stat: string | null | undefined,
  bonus: number | null | undefined,
): StatBonus | null {
  if (stat === undefined || stat === null) {
    return null;
  }
  return StatBonus.create({ stat, amount: bonus });
}

/** Projette une entité vers sa vue publique (sans compétences ⇒ tableau vide par défaut). */
export function toView(item: ReferenceItem, competenceIds: string[] = []): ReferenceItemView {
  const statBonus = item.statBonus;
  return {
    id: item.id,
    name: item.name.value,
    createdAt: item.createdAt,
    stat: statBonus?.stat ?? null,
    bonus: statBonus?.amount ?? null,
    protectionPoints: item.protectionPoints,
    description: item.description,
    competenceIds,
  };
}
