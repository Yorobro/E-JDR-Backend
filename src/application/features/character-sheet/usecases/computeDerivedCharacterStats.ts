import { ALLOWED_STATS, Stat } from "@domain/features/reference/value-objects/StatBonus";

/**
 * Vue minimale d'un élément de référence porteur d'un bonus de stat (formation ou peuple), telle
 * que requise pour le calcul des dérivés. Compatible avec `ResolvedReferenceView`/`ResolvedFormationView`.
 */
export interface DerivedStatSource {
  /** Statistique ciblée par le bonus (ex. `"vigueur"`), ou `null` si l'élément n'en porte pas. */
  readonly stat: string | null;
  /** Montant du bonus, ou `null` si non renseigné (traité comme 0). */
  readonly bonus: number | null;
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
  /** Formation résolue (nom + bonus), ou `null` si la fiche n'en porte pas. */
  readonly formation: DerivedStatSource | null;
  /** Peuple résolu (nom + bonus), ou `null` si la fiche n'en porte pas. */
  readonly peuple: DerivedStatSource | null;
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

/** Additionne le bonus d'une source uniquement s'il cible la stat demandée (`null` ⇒ 0). */
function bonusFor(source: DerivedStatSource | null, statKey: Stat): number {
  if (source === null || source.stat !== statKey) {
    return 0;
  }
  return source.bonus ?? 0;
}

/**
 * Calcule les statistiques **dérivées** d'une fiche, à partir de ses seules données de lecture.
 *
 * Fonction **pure** (aucun effet de bord, déterministe) partagée par la lecture détaillée et
 * l'export PDF, afin que la formule reste unique (DRY). Les valeurs sont calculées à la lecture et
 * ne sont **jamais** persistées en base.
 *
 * - `statTotals[k] = (base[k] ?? 0) + bonus de la formation ciblant `k` + bonus du peuple ciblant
 *   `k`` (un bonus ciblant une autre stat est ignoré pour `k`).
 * - `pointsDeVie = 10 + statTotals.vigueur` (la vigueur totale dérive donc des totaux, sans double
 *   calcul).
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
        bonusFor(input.peuple, statKey);
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
