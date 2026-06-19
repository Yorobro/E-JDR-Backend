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

/** Données d'entrée du calcul des stats dérivées d'une fiche. */
export interface DerivedCharacterStatsInput {
  /** Vigueur de base portée par la fiche (`null` ⇒ 0). */
  readonly vigueur: number | null;
  /** Formation résolue (nom + bonus), ou `null` si la fiche n'en porte pas. */
  readonly formation: DerivedStatSource | null;
  /** Peuple résolu (nom + bonus), ou `null` si la fiche n'en porte pas. */
  readonly peuple: DerivedStatSource | null;
  /** Armures liées à la fiche (vide si aucune). */
  readonly armures: readonly DerivedArmureSource[];
}

/** Stats dérivées (calculées à la lecture, jamais stockées en dur). */
export interface DerivedCharacterStats {
  /** Points de vie : `10 + vigueurTotale`. */
  readonly pointsDeVie: number;
  /** Protection : somme des points de protection des armures liées. */
  readonly protection: number;
}

/** Constante de base ajoutée à la vigueur totale pour obtenir les points de vie. */
const BASE_POINTS_DE_VIE = 10;

/** Statistique ciblée par un bonus pour qu'il compte dans la vigueur totale. */
const VIGUEUR_STAT = "vigueur";

/** Additionne le bonus d'une source uniquement s'il cible la vigueur (`null` ⇒ 0). */
function vigueurBonusOf(source: DerivedStatSource | null): number {
  if (source === null || source.stat !== VIGUEUR_STAT) {
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
 * - `vigueurTotale = (vigueur ?? 0) + bonus de la formation ciblant 'vigueur' + bonus du peuple
 *   ciblant 'vigueur'` (un bonus ciblant une autre stat est ignoré).
 * - `pointsDeVie = 10 + vigueurTotale`.
 * - `protection = Σ (armure.protectionPoints ?? 0)` (0 si aucune armure).
 *
 * @param input - Vigueur de base, formation/peuple résolus et armures liées.
 * @returns Les points de vie et la protection dérivés.
 */
export function computeDerivedCharacterStats(
  input: DerivedCharacterStatsInput,
): DerivedCharacterStats {
  const vigueurTotale =
    (input.vigueur ?? 0) + vigueurBonusOf(input.formation) + vigueurBonusOf(input.peuple);

  const protection = input.armures.reduce(
    (total, armure) => total + (armure.protectionPoints ?? 0),
    0,
  );

  return {
    pointsDeVie: BASE_POINTS_DE_VIE + vigueurTotale,
    protection,
  };
}
