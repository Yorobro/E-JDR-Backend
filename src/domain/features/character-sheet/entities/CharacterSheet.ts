import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import { Sex } from "@domain/features/character-sheet/value-objects/Sex";
import { Purse } from "@domain/features/character-sheet/value-objects/Purse";

/**
 * Champs **détaillés et éditables** d'une fiche (hors identité technique : id, ownerId,
 * createdAt). Tous optionnels et nullables : la saisie est souple (seul le `name` est requis,
 * porté à part par {@link CharacterSheetName}). Aucune règle métier sur les valeurs.
 */
export interface CharacterSheetDetails {
  // Identité — formation & peuple sont désormais des **références N‑1** vers les catalogues de
  // l'utilisateur (id nullable). niveau/âge entiers, sexe contraint M/F/NB.
  readonly formationId: string | null;
  readonly niveau: number | null;
  readonly peupleId: string | null;
  readonly sexe: Sex | null;
  readonly tailleEtPoids: string | null;
  readonly age: number | null;
  readonly apparence: string | null;
  // Caractéristiques (entiers)
  readonly dexterite: number | null;
  readonly intelligence: number | null;
  readonly perception: number | null;
  readonly social: number | null;
  readonly vigueur: number | null;
  // Ressources de combat (entiers)
  readonly pointsDeVie: number | null;
  readonly pointsDeMagie: number | null;
  readonly protection: number | null;
  // Bourse (value object)
  readonly purse: Purse | null;
  // Zone de texte long restante (armes/armures/compétences/équipement/sorts/miracles sont passés
  // en N‑N, gérés hors de cette entité via les liaisons fiche↔éléments de référence).
  readonly notes: string | null;
}

/** Instantané « tout à null » des champs détaillés, utilisé comme base de création. */
const EMPTY_DETAILS: CharacterSheetDetails = {
  formationId: null,
  niveau: null,
  peupleId: null,
  sexe: null,
  tailleEtPoids: null,
  age: null,
  apparence: null,
  dexterite: null,
  intelligence: null,
  perception: null,
  social: null,
  vigueur: null,
  pointsDeVie: null,
  pointsDeMagie: null,
  protection: null,
  purse: null,
  notes: null,
};

/**
 * Valeurs par défaut appliquées **uniquement à la création** d'une fiche (factory `create()`).
 * Elles priment sur {@link EMPTY_DETAILS} mais sont surchargées par les params fournis.
 */
const CREATION_DEFAULTS: Partial<CharacterSheetDetails> = {
  niveau: 1,
  dexterite: 0,
  intelligence: 0,
  perception: 0,
  social: 0,
  vigueur: 0,
  pointsDeMagie: 0,
  purse: Purse.create({}),
};

/**
 * Données nécessaires pour reconstruire une `CharacterSheet` existante (ex : depuis la base).
 * Le nom est déjà un value object validé via {@link CharacterSheetName} ; les champs détaillés
 * sont des primitifs nullables ({@link CharacterSheetDetails}).
 */
export interface CharacterSheetSnapshot extends CharacterSheetDetails {
  /** Identifiant unique de la fiche. */
  readonly id: string;
  /** Identifiant de l'utilisateur propriétaire de la fiche. */
  readonly ownerId: string;
  /** Identifiant du groupe d'amis auquel la fiche appartient (visibilité = tout le groupe). */
  readonly groupId: string;
  /** Nom de la fiche (value object garantissant la validité). */
  readonly name: CharacterSheetName;
  /** Date de création de la fiche. */
  readonly createdAt: Date;
}

/**
 * Entité métier représentant une **fiche de personnage** appartenant à un utilisateur.
 *
 * Une fiche existe indépendamment des campagnes : elle appartient à son propriétaire
 * (`ownerId`) et peut ensuite être rattachée à plusieurs campagnes (relation gérée hors de
 * cette entité, par la liaison `campaign_characters`). Immuable de l'extérieur (aucun setter).
 * Le nom est porté par un value object {@link CharacterSheetName} garantissant sa validité ;
 * les champs détaillés ({@link CharacterSheetDetails}) sont des primitifs nullables modifiables
 * via {@link CharacterSheet.withDetails}.
 */
export class CharacterSheet {
  /**
   * Constructeur privé : la création passe par les factories {@link CharacterSheet.create}
   * (nouvelle fiche) ou {@link CharacterSheet.restore} (fiche existante).
   *
   * @param props - L'instantané complet et déjà validé de la fiche.
   */
  private constructor(private readonly props: CharacterSheetSnapshot) {}

  /**
   * Crée une **nouvelle** fiche de personnage. L'utilisateur fourni en `ownerId` en devient
   * le propriétaire. Les champs détaillés non fournis sont initialisés à `null`.
   *
   * @param params - Les données de la nouvelle fiche.
   * @param params.id - Identifiant unique (généré en amont par un `IdGeneratorService`).
   * @param params.ownerId - Identifiant du propriétaire (l'utilisateur authentifié).
   * @param params.groupId - Identifiant du groupe d'amis dans lequel la fiche est créée.
   * @param params.name - Nom de la fiche (value object déjà validé).
   * @param params.createdAt - Horodatage de création (injecté pour rester testable).
   * @returns Une nouvelle instance de `CharacterSheet`.
   */
  public static create(
    params: {
      id: string;
      ownerId: string;
      groupId: string;
      name: CharacterSheetName;
      createdAt: Date;
    } & Partial<CharacterSheetDetails>,
  ): CharacterSheet {
    return new CharacterSheet({
      ...EMPTY_DETAILS,
      ...CREATION_DEFAULTS,
      ...params,
    });
  }

  /**
   * Reconstruit une fiche **existante** à partir d'un instantané (ex : ligne de BDD mappée).
   *
   * @param snapshot - L'état complet et déjà validé de la fiche.
   * @returns L'instance de `CharacterSheet` reconstruite.
   */
  public static restore(snapshot: CharacterSheetSnapshot): CharacterSheet {
    return new CharacterSheet(snapshot);
  }

  /** @returns L'identifiant unique de la fiche. */
  public get id(): string {
    return this.props.id;
  }

  /** @returns L'identifiant du propriétaire de la fiche. */
  public get ownerId(): string {
    return this.props.ownerId;
  }

  /** @returns L'identifiant du groupe d'amis auquel la fiche appartient. */
  public get groupId(): string {
    return this.props.groupId;
  }

  /** @returns Le nom de la fiche (value object). */
  public get name(): CharacterSheetName {
    return this.props.name;
  }

  /** @returns La date de création de la fiche. */
  public get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * @returns Les champs détaillés de la fiche (identité, caractéristiques, textes longs).
   *   Utile pour projeter la fiche complète sans exposer le value object `name`.
   */
  public get details(): CharacterSheetDetails {
    const { id, ownerId, groupId, name, createdAt, ...details } = this.props;
    void id;
    void ownerId;
    void groupId;
    void name;
    void createdAt;
    return details;
  }

  /**
   * Indique si l'utilisateur donné est le **propriétaire** de cette fiche.
   *
   * Exprime l'invariant de propriété : les opérations réservées au propriétaire (suppression,
   * modification, rattachement…) s'appuient sur cette règle plutôt que de comparer des
   * identifiants ailleurs.
   *
   * @param userId - L'identifiant de l'utilisateur à tester.
   * @returns `true` si l'utilisateur est le propriétaire, `false` sinon.
   */
  public isOwnedBy(userId: string): boolean {
    return this.props.ownerId === userId;
  }

  /**
   * Indique si cette fiche appartient au **groupe** donné.
   *
   * Exprime l'invariant de scoping par groupe (D3) : la visibilité « tout le groupe » et les
   * liaisons fiche↔campagne s'appuient sur l'appartenance au même groupe.
   *
   * @param groupId - L'identifiant du groupe à tester.
   * @returns `true` si la fiche appartient au groupe, `false` sinon.
   */
  public isInGroup(groupId: string): boolean {
    return this.props.groupId === groupId;
  }

  /**
   * Produit une **nouvelle** instance avec un nom et/ou des champs détaillés modifiés, sans
   * muter l'originale. L'identité technique (id, ownerId, createdAt) est préservée.
   *
   * @param changes - Le nouveau nom (optionnel) et les champs détaillés à remplacer (partiels).
   * @returns Une nouvelle `CharacterSheet` reflétant les changements.
   */
  public withDetails(
    changes: { name?: CharacterSheetName } & Partial<CharacterSheetDetails>,
  ): CharacterSheet {
    return new CharacterSheet({ ...this.props, ...changes });
  }
}
