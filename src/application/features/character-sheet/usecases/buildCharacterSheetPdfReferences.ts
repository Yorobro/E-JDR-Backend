import { CharacterSheetPdfReferences } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfReferences";
import {
  ResolvedFormationView,
  ResolvedReferenceView,
} from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";

/** Formation + peuple résolus (vues de lecture), tels que produits par le resolver. */
interface ResolvedReferencesInput {
  readonly formation: ResolvedFormationView | null;
  readonly peuple: ResolvedReferenceView | null;
}

/**
 * Listes d'éléments **liés** à la fiche (entités de référence brutes), une par catégorie liable.
 *
 * Les compétences n'y figurent pas : elles ne sont pas liées à la fiche mais **dérivées de la
 * formation** (cf. {@link buildCharacterSheetPdfReferences}).
 */
interface LinkedItemsInput {
  readonly armes: ReferenceItem[];
  readonly armures: ReferenceItem[];
  readonly equipements: ReferenceItem[];
  readonly sorts: ReferenceItem[];
  readonly miracles: ReferenceItem[];
}

/**
 * Assemble le contrat **plat** {@link CharacterSheetPdfReferences} attendu par le générateur PDF à
 * partir de la formation/peuple **résolus** et des **listes** d'éléments liés à la fiche.
 *
 * - `formationName` / `peupleName` : nom de l'élément résolu, ou `null` s'il est absent.
 * - listes (`armes`, …) : noms des éléments liés (value object `name.value`), dans l'ordre fourni.
 * - `competences` : noms des compétences **apportées par la formation**. Elles ne sont pas liées à
 *   la fiche : la liaison N‑N `sheet_competences` n'est plus alimentée depuis que les compétences
 *   sont 100 % dérivées de la formation. Les lire depuis cette liaison morte est ce qui vidait la
 *   boîte « COMPÉTENCES » du PDF.
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
    competences: (resolved.formation?.competences ?? []).map((competence) => competence.name),
    equipements: lists.equipements.map((item) => item.name.value),
    sorts: lists.sorts.map((item) => item.name.value),
    miracles: lists.miracles.map((item) => item.name.value),
  };
}
