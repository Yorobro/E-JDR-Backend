import { CharacterSheetPdfReferences } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfReferences";
import {
  ResolvedFormationView,
  ResolvedReferenceView,
} from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";

/** Montant par défaut d'un bonus de stat lorsqu'aucun n'est renseigné sur l'élément résolu. */
const DEFAULT_STAT_BONUS_AMOUNT = 1;

/** Formation + peuple résolus (vues de lecture), tels que produits par le resolver. */
interface ResolvedReferencesInput {
  readonly formation: ResolvedFormationView | null;
  readonly peuple: ResolvedReferenceView | null;
}

/** Listes d'éléments liés à la fiche (entités de référence brutes), une par catégorie liable. */
interface LinkedItemsInput {
  readonly armes: ReferenceItem[];
  readonly armures: ReferenceItem[];
  readonly competences: ReferenceItem[];
  readonly equipements: ReferenceItem[];
}

/**
 * Assemble le contrat **plat** {@link CharacterSheetPdfReferences} attendu par le générateur PDF à
 * partir de la formation/peuple **résolus** et des **listes** d'éléments liés à la fiche.
 *
 * - `formationName` / `peupleName` : nom de l'élément résolu, ou `null` s'il est absent.
 * - listes (`armes`, …) : noms des éléments liés (value object `name.value`), dans l'ordre fourni.
 * - `statBonuses` : un par élément résolu (formation puis peuple) qui porte une stat ; le montant
 *   vaut le bonus résolu, ou {@link DEFAULT_STAT_BONUS_AMOUNT} à défaut.
 *
 * @param resolved - La formation et le peuple résolus (ou `null`).
 * @param lists - Les listes d'éléments liés à la fiche.
 * @returns Les références prêtes à imprimer.
 */
export function buildCharacterSheetPdfReferences(
  resolved: ResolvedReferencesInput,
  lists: LinkedItemsInput,
): CharacterSheetPdfReferences {
  return {
    formationName: resolved.formation?.name ?? null,
    peupleName: resolved.peuple?.name ?? null,
    armes: lists.armes.map((item) => item.name.value),
    armures: lists.armures.map((item) => item.name.value),
    competences: lists.competences.map((item) => item.name.value),
    equipements: lists.equipements.map((item) => item.name.value),
    statBonuses: toStatBonuses(resolved),
  };
}

/** Agrège les bonus de stat portés par la formation et le peuple résolus (stat non nulle). */
function toStatBonuses(resolved: ResolvedReferencesInput): { stat: string; amount: number }[] {
  return [resolved.formation, resolved.peuple]
    .filter((view): view is ResolvedReferenceView => view != null && view.stat !== null)
    .map((view) => ({
      stat: view.stat as string,
      amount: view.bonus ?? DEFAULT_STAT_BONUS_AMOUNT,
    }));
}
