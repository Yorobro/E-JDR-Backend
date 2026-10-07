import { ALLOWED_STATS, Stat } from "@domain/features/reference/value-objects/StatBonus";

/**
 * Vue minimale d'une source **mono-bonus** (la **formation**) : au plus une paire (stat, bonus).
 * Compatible avec `ResolvedFormationView`.
 */
export interface DerivedStatSource {
  /** Statistique ciblée par le bonus (ex. `"vigueur"`), ou `null` si l'élément n'en porte pas. */
  readonly stat: string | null;
  /** Montant du bonus, ou `null` si non renseigné (traité comme 0). */
  readonly bonus: number | null;
}

/** Une entrée d'une source multi-bonus : la stat ciblée et son montant. */
export interface DerivedStatBonusEntry {
  readonly stat: string;
  readonly bonus: number;
}

/**
 * Vue minimale d'une source **multi-bonus** (le **peuple**) : 0..N bonus, au plus un par stat.
 * Compatible avec `ResolvedPeupleView`.
 */
export interface DerivedMultiStatSource {
  readonly statBonuses: readonly DerivedStatBonusEntry[];
}

/** Vue minimale d'une armure liée pour le calcul de la protection. */
export interface DerivedArmureSource {
  /** Points de protection portés par l'armure, ou `null` (traité comme 0). */
  readonly protectionPoints: number | null;
}

/** Statistiques de base d'une fiche (saisie souple : `null` ⇒ 0 dans les totaux). */
export interface DerivedStatBases {
  readonly dexterite: number | null;
  readonly intelligence: number | null;
  readonly perception: number | null;
  readonly social: number | null;
  readonly vigueur: number | null;
}

/** Données d'entrée du calcul des stats dérivées d'une fiche. */
export interface DerivedCharacterStatsInput extends DerivedStatBases {
  /** Formation résolue (au plus **un** bonus), ou `null` si la fiche n'en porte pas. */
  readonly formation: DerivedStatSource | null;
  /** Peuple résolu (**0..N** bonus, au plus un par stat), ou `null` si la fiche n'en porte pas. */
  readonly peuple: DerivedMultiStatSource | null;
  /** Armures liées à la fiche (vide si aucune). */
  readonly armures: readonly DerivedArmureSource[];
}

/**
 * Totaux par caractéristique : `base + bonus formation ciblant la stat + bonus peuple ciblant la
 * stat`. Toujours un nombre (jamais `null`).
 */
export type StatTotals = Readonly<Record<Stat, number>>;

/** Stats dérivées (calculées à la lecture, jamais stockées en dur). */
export interface DerivedCharacterStats {
  /** Totaux par caractéristique (base + bonus formation + bonus peuple). */
  readonly statTotals: StatTotals;
  /** Points de vie : `10 + statTotals.vigueur`. */
  readonly pointsDeVie: number;
  /** Protection : somme des points de protection des armures liées. */
  readonly protection: number;
}

/** Constante de base ajoutée à la vigueur totale pour obtenir les points de vie. */
const BASE_POINTS_DE_VIE = 10;

/** Additionne le bonus d'une source **mono-bonus** (formation) s'il cible la stat demandée. */
function bonusFor(source: DerivedStatSource | null, statKey: Stat): number {
  if (source === null || source.stat !== statKey) {
    return 0;
  }
  return source.bonus ?? 0;
}

/**
 * Somme les bonus d'une source **multi-bonus** (peuple) ciblant la stat demandée.
 *
 * En pratique il y en a au plus un (l'unicité par stat est garantie par le domaine et par la PK
 * composite de `peuple_stat_bonuses`) ; on somme quand même, pour rester correct si la donnée
 * dérivait.
 */
function bonusesFor(source: DerivedMultiStatSource | null, statKey: Stat): number {
  if (source === null) {
    return 0;
  }
  return source.statBonuses.reduce(
    (total, entry) => (entry.stat === statKey ? total + (entry.bonus ?? 0) : total),
    0,
  );
}

/**
 * Calcule les statistiques **dérivées** d'une fiche, à partir de ses seules données de lecture.
 *
 * Fonction **pure** (aucun effet de bord, déterministe) partagée par la lecture détaillée et
 * l'export PDF, afin que la formule reste unique (DRY). Les valeurs sont calculées à la lecture et
 * ne sont **jamais** persistées en base.
 *
 * - `statTotals[k] = (base[k] ?? 0) + bonus de la formation ciblant `k` + bonus du peuple ciblant
 *   `k`` (un bonus ciblant une autre stat est ignoré pour `k`). La formation apporte au plus un
 *   bonus ; le peuple peut en apporter plusieurs, sur des stats **différentes**.
 * - `pointsDeVie = 10 + statTotals.vigueur` (la vigueur totale dérive donc des totaux, sans double
 *   calcul) : un bonus de peuple portant sur la vigueur augmente donc aussi les points de vie.
 * - `protection = Σ (armure.protectionPoints ?? 0)` (0 si aucune armure).
 *
 * @param input - Bases des 5 caractéristiques, formation/peuple résolus et armures liées.
 * @returns Les totaux par caractéristique, les points de vie et la protection dérivés.
 */
export function computeDerivedCharacterStats(
  input: DerivedCharacterStatsInput,
): DerivedCharacterStats {
  const statTotals = ALLOWED_STATS.reduce(
    (totals, statKey) => {
      totals[statKey] =
        (input[statKey] ?? 0) +
        bonusFor(input.formation, statKey) +
        bonusesFor(input.peuple, statKey);
      return totals;
    },
    {} as Record<Stat, number>,
  );

  const protection = input.armures.reduce(
    (total, armure) => total + (armure.protectionPoints ?? 0),
    0,
  );

  return {
    statTotals,
    pointsDeVie: BASE_POINTS_DE_VIE + statTotals.vigueur,
    protection,
  };
}
