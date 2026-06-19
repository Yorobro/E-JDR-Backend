import {
  ResolvedCompetenceView,
  ResolvedFormationView,
  ResolvedReferenceView,
} from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import { ReferenceRepository } from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";
import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";

/**
 * Dépendances de {@link CharacterSheetReferenceResolver} (objet pour rester sous la limite de
 * paramètres de constructeur `ejdr/parameter-count`).
 */
export interface CharacterSheetReferenceResolverDeps {
  /** Catalogue des formations (résolution du nom + bonus de la formation portée par la fiche). */
  readonly formationRepository: ReferenceRepository;
  /** Catalogue des peuples (résolution du nom + bonus du peuple porté par la fiche). */
  readonly peupleRepository: ReferenceRepository;
  /** Catalogue des compétences (résolution des noms des compétences liées à la formation). */
  readonly competenceRepository: ReferenceRepository;
  /** Liaison formation ↔ compétences (ids des compétences rattachées à la formation). */
  readonly formationCompetenceLink: FormationCompetenceLinkRepository;
}

/** Formation + peuple résolus (nom + bonus, compétences pour la formation), chacun nullable. */
export interface ResolvedSheetReferences {
  readonly formation: ResolvedFormationView | null;
  readonly peuple: ResolvedReferenceView | null;
}

/**
 * Résout la **formation** et le **peuple** actifs d'une fiche (nom + bonus de stat) — et, pour la
 * formation, ses **compétences** liées — à partir des seuls identifiants portés par la fiche.
 *
 * Règles communes (défense en profondeur) : un id `null` → `null` ; un id qui ne correspond plus à
 * un élément existant → `null` ; un élément résolu appartenant à un **autre groupe** que la fiche
 * → `null` (on ne révèle jamais le catalogue d'un groupe tiers, même si la fiche porte un id
 * étranger). Le bonus n'est **pas** appliqué : c'est une lecture pure d'affichage.
 *
 * Logique extraite de `GetCharacterSheetUseCaseImpl` pour être partagée avec l'export PDF.
 */
export class CharacterSheetReferenceResolver {
  private readonly formationRepository: ReferenceRepository;
  private readonly peupleRepository: ReferenceRepository;
  private readonly competenceRepository: ReferenceRepository;
  private readonly formationCompetenceLink: FormationCompetenceLinkRepository;

  constructor(deps: CharacterSheetReferenceResolverDeps) {
    this.formationRepository = deps.formationRepository;
    this.peupleRepository = deps.peupleRepository;
    this.competenceRepository = deps.competenceRepository;
    this.formationCompetenceLink = deps.formationCompetenceLink;
  }

  /**
   * Résout la formation et le peuple actifs de la fiche.
   *
   * @param formationId - Id de la formation portée par la fiche (ou `null`).
   * @param peupleId - Id du peuple porté par la fiche (ou `null`).
   * @param sheetGroupId - Groupe propriétaire de la fiche (pour le contrôle de portée).
   * @returns Les vues résolues (chacune `null` selon les règles décrites sur la classe).
   */
  public async resolve(
    formationId: string | null,
    peupleId: string | null,
    sheetGroupId: string,
  ): Promise<ResolvedSheetReferences> {
    const formation = await this.resolveFormation(formationId, sheetGroupId);
    const peuple = await this.resolvePeuple(peupleId, sheetGroupId);
    return { formation, peuple };
  }

  /**
   * Résout la formation active (nom + bonus + compétences liées), ou `null` si la fiche n'en porte
   * pas, si l'id ne correspond plus à un élément existant, ou si l'élément résolu appartient à un
   * **autre groupe** que la fiche.
   */
  private async resolveFormation(
    formationId: string | null,
    sheetGroupId: string,
  ): Promise<ResolvedFormationView | null> {
    if (formationId === null) {
      return null;
    }
    const formation = await this.formationRepository.findById(formationId);
    if (formation === null || !formation.isInGroup(sheetGroupId)) {
      return null;
    }
    const competences = await this.resolveCompetences(formationId);
    return { ...toReferenceView(formation), competences };
  }

  /**
   * Résout le peuple actif (nom + bonus), ou `null` si la fiche n'en porte pas, si l'id ne
   * correspond plus à un élément existant, ou si l'élément résolu appartient à un **autre groupe**
   * que la fiche.
   */
  private async resolvePeuple(
    peupleId: string | null,
    sheetGroupId: string,
  ): Promise<ResolvedReferenceView | null> {
    if (peupleId === null) {
      return null;
    }
    const peuple = await this.peupleRepository.findById(peupleId);
    return peuple === null || !peuple.isInGroup(sheetGroupId) ? null : toReferenceView(peuple);
  }

  /** Charge les compétences (id + nom) rattachées à la formation, en ignorant les ids orphelins. */
  private async resolveCompetences(formationId: string): Promise<ResolvedCompetenceView[]> {
    const competenceIds =
      await this.formationCompetenceLink.findCompetenceIdsByFormation(formationId);
    const competences: ResolvedCompetenceView[] = [];
    for (const competenceId of competenceIds) {
      const competence = await this.competenceRepository.findById(competenceId);
      if (competence !== null) {
        competences.push({ id: competence.id, name: competence.name.value });
      }
    }
    return competences;
  }
}

/** Projette un élément de référence vers sa vue résolue (id + nom + bonus de stat). */
function toReferenceView(item: ReferenceItem): ResolvedReferenceView {
  const statBonus = item.statBonus;
  return {
    id: item.id,
    name: item.name.value,
    stat: statBonus?.stat ?? null,
    bonus: statBonus?.amount ?? null,
  };
}
