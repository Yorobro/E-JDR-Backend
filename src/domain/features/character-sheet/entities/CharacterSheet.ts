import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";

/**
 * Données nécessaires pour reconstruire une `CharacterSheet` existante (ex : depuis la base).
 * Le nom est déjà un value object validé via {@link CharacterSheetName}.
 */
export interface CharacterSheetSnapshot {
  /** Identifiant unique de la fiche. */
  readonly id: string;
  /** Identifiant de l'utilisateur propriétaire de la fiche. */
  readonly ownerId: string;
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
 * Le nom est porté par un value object {@link CharacterSheetName} garantissant sa validité.
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
   * le propriétaire.
   *
   * @param params - Les données de la nouvelle fiche.
   * @param params.id - Identifiant unique (généré en amont par un `IdGeneratorService`).
   * @param params.ownerId - Identifiant du propriétaire (l'utilisateur authentifié).
   * @param params.name - Nom de la fiche (value object déjà validé).
   * @param params.createdAt - Horodatage de création (injecté pour rester testable).
   * @returns Une nouvelle instance de `CharacterSheet`.
   */
  public static create(params: {
    id: string;
    ownerId: string;
    name: CharacterSheetName;
    createdAt: Date;
  }): CharacterSheet {
    return new CharacterSheet(params);
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

  /** @returns Le nom de la fiche (value object). */
  public get name(): CharacterSheetName {
    return this.props.name;
  }

  /** @returns La date de création de la fiche. */
  public get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Indique si l'utilisateur donné est le **propriétaire** de cette fiche.
   *
   * Exprime l'invariant de propriété : les opérations réservées au propriétaire (suppression,
   * rattachement…) s'appuient sur cette règle plutôt que de comparer des identifiants ailleurs.
   *
   * @param userId - L'identifiant de l'utilisateur à tester.
   * @returns `true` si l'utilisateur est le propriétaire, `false` sinon.
   */
  public isOwnedBy(userId: string): boolean {
    return this.props.ownerId === userId;
  }
}
