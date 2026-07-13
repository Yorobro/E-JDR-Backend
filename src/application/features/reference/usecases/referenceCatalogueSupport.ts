import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { StatBonus } from "@domain/features/reference/value-objects/StatBonus";

import { TransactionalRepositories } from "@application/shared/UnitOfWork";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";
import { PeupleStatBonusRepository } from "@application/features/reference/abstractions/repositories/PeupleStatBonusRepository";
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
 * Dépendances **spécifiques aux peuples** pour l'écriture : les bonus de statistique (0..N).
 * Absentes pour les autres types — un `statBonuses` fourni serait alors ignoré.
 *
 * Leur **présence** est aussi ce qui signale au use case qu'il gère un peuple : dans ce cas les
 * colonnes historiques `stat`/`bonus` ne sont plus écrites (elles seraient comptées deux fois).
 */
export interface PeupleWriteDeps {
  /** Bonus du peuple, sélectionnés dans la transaction (écriture). */
  readonly peupleStatBonuses: (repos: TransactionalRepositories) => PeupleStatBonusRepository;
}

/**
 * Dépendances **spécifiques aux peuples** pour la lecture : les bonus de statistique (lecture pure)
 * afin de renseigner `statBonuses` dans la vue. Absentes pour les autres types.
 */
export interface PeupleListDeps {
  /** Bonus du peuple (lecture pure). */
  readonly peupleStatBonuses: PeupleStatBonusRepository;
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

/**
 * Construit la **liste** des bonus d'un peuple à partir des entrées brutes.
 *
 * Repli de compatibilité : si `entries` est absent alors qu'une `stat` historique est fournie
 * (client antérieur au multi-bonus), on en dérive une entrée unique. Sans ce repli, un ancien
 * client créerait silencieusement des peuples **sans aucun bonus**.
 *
 * @param entries - Les bonus explicites (contrat courant).
 * @param legacyStat - La stat unique envoyée par un ancien client.
 * @param legacyBonus - Le montant unique envoyé par un ancien client.
 * @returns Les `StatBonus` validés (au plus un par stat).
 * @throws {DomainError} Si un bonus est invalide, ou si une stat est répétée (capté par l'appelant).
 */
export function buildStatBonuses(
  entries: { stat: string; bonus?: number | null }[] | undefined,
  legacyStat?: string | null,
  legacyBonus?: number | null,
): StatBonus[] {
  if (entries === undefined && legacyStat !== undefined && legacyStat !== null) {
    return StatBonus.createMany([{ stat: legacyStat, amount: legacyBonus }]);
  }
  return StatBonus.createMany((entries ?? []).map((e) => ({ stat: e.stat, amount: e.bonus })));
}

/**
 * Projette une entité vers sa vue publique.
 *
 * @param item - L'élément de référence.
 * @param competenceIds - Compétences rattachées (formations ; vide ailleurs).
 * @param statBonuses - Bonus du **peuple** (0..N). **Sa présence signale un peuple** : `stat` et
 *   `bonus` sont alors forcés à `null`. Sans ça, un peuple créé avant la migration remonterait son
 *   bonus **deux fois** — une fois par la colonne historique `peoples.stat`, une fois par la table
 *   `peuple_stat_bonuses` (que le backfill a alimentée depuis cette même colonne).
 */
export function toView(
  item: ReferenceItem,
  competenceIds: string[] = [],
  statBonuses?: StatBonus[],
): ReferenceItemView {
  const isPeuple = statBonuses !== undefined;
  const statBonus = item.statBonus;
  return {
    id: item.id,
    name: item.name.value,
    createdAt: item.createdAt,
    stat: isPeuple ? null : (statBonus?.stat ?? null),
    bonus: isPeuple ? null : (statBonus?.amount ?? null),
    statBonuses: (statBonuses ?? []).map((sb) => ({ stat: sb.stat, bonus: sb.amount })),
    protectionPoints: item.protectionPoints,
    description: item.description,
    competenceIds,
  };
}
