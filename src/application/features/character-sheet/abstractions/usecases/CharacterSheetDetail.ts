/**
 * Représentation publique **complète** (lecture) d'une fiche de personnage.
 *
 * Renvoyée par les use cases de consultation détaillée (get-by-id) et de mise à jour. Contient
 * l'identité technique, le nom et tous les champs détaillés (identité, caractéristiques, textes
 * longs). Les champs détaillés sont nullables (saisie souple). Distincte du `CharacterSheetSummary`
 * (nom seul) utilisé dans les listes.
 */
export interface CharacterSheetDetail {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly createdAt: Date;
  // Campagne de rattachement (modèle « une fiche = une campagne »).
  readonly campaignId: string;
  /** Nom de la campagne (renseigné par le use case de lecture ; `""` par défaut dans la projection). */
  readonly campaignName: string;
  /** Statut du rattachement : `"PENDING"` ou `"ACCEPTED"`. */
  readonly linkStatus: string;
  // Identité — formation/peuple = id de l'élément de référence (ou null), niveau/âge entiers
  readonly formationId: string | null;
  readonly niveau: number | null;
  readonly peupleId: string | null;
  readonly sexe: string | null;
  readonly tailleEtPoids: string | null;
  readonly age: number | null;
  readonly apparence: string | null;
  // Caractéristiques de **base** (entiers, saisie souple ⇒ nullable). Inchangées par les bonus.
  readonly dexterite: number | null;
  readonly intelligence: number | null;
  readonly perception: number | null;
  readonly social: number | null;
  readonly vigueur: number | null;
  // Caractéristiques **totales** (dérivées, jamais stockées) : base + bonus du peuple ciblant la
  // stat + bonus de la formation ciblant la stat. Toujours un nombre (base nulle comptée 0).
  readonly dexteriteTotale: number;
  readonly intelligenceTotale: number;
  readonly perceptionTotale: number;
  readonly socialTotale: number;
  readonly vigueurTotale: number;
  // Ressources de combat (entiers)
  readonly pointsDeVie: number | null;
  readonly pointsDeMagie: number | null;
  readonly protection: number | null;
  // Bourse (pièces brutes)
  readonly purse: PurseView | null;
  // Zone de texte long restante (armes/armures/compétences/équipement/sorts/miracles = listes liées,
  // exposées à part par le use case de lecture des liaisons fiche↔référence).
  readonly notes: string | null;
  // Éléments de référence résolus (lecture seule, pour l'affichage). `null` si la fiche ne porte
  // pas l'id correspondant. Le bonus n'est PAS appliqué côté back : la fiche conserve ses stats de
  // base inchangées ; le front affiche base + bonus + total.
  readonly formation: ResolvedFormationView | null;
  readonly peuple: ResolvedPeupleView | null;
}

/** Représentation publique de la bourse (pièces brutes, non normalisées). */
export interface PurseView {
  readonly gold: number;
  readonly silver: number;
  readonly copper: number;
}

/**
 * Élément de référence résolu (nom + bonus de stat) joint à une fiche. Base de la formation.
 * `stat`/`bonus` sont `null` si l'élément ne porte pas de bonus.
 */
export interface ResolvedReferenceView {
  readonly id: string;
  readonly name: string;
  readonly stat: string | null;
  readonly bonus: number | null;
}

/** Formation résolue : un élément de référence enrichi des compétences qui lui sont rattachées. */
export interface ResolvedFormationView extends ResolvedReferenceView {
  /** Compétences liées à la formation (id + nom), résolues depuis le catalogue du groupe. */
  readonly competences: ResolvedCompetenceView[];
}

/**
 * Peuple résolu : contrairement à la formation (mono-bonus), un peuple porte **0..N** bonus de
 * statistique, au plus un par stat. Il n'expose donc **pas** `stat`/`bonus`.
 */
export interface ResolvedPeupleView {
  readonly id: string;
  readonly name: string;
  /** Bonus apportés par le peuple (vide s'il n'en porte aucun). */
  readonly statBonuses: ResolvedStatBonusView[];
}

/** Un bonus de statistique apporté par le peuple. */
export interface ResolvedStatBonusView {
  readonly stat: string;
  readonly bonus: number;
}

/** Compétence rattachée à une formation (id + nom). */
export interface ResolvedCompetenceView {
  readonly id: string;
  readonly name: string;
}
