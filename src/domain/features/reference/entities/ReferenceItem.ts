import { ReferenceName } from "@domain/features/reference/value-objects/ReferenceName";

/**
 * Données nécessaires pour reconstruire un `ReferenceItem` existant (ex : depuis la base).
 * Le nom est déjà un value object validé via {@link ReferenceName}.
 */
export interface ReferenceItemSnapshot {
  /** Identifiant unique de l'élément. */
  readonly id: string;
  /** Identifiant de l'utilisateur propriétaire de l'élément. */
  readonly ownerId: string;
  /** Nom de l'élément (value object garantissant la validité). */
  readonly name: ReferenceName;
  /** Date de création de l'élément. */
  readonly createdAt: Date;
}

/**
 * Entité métier représentant un **élément de référence créé par un utilisateur** : une formation,
 * un peuple, une arme, une armure, une compétence ou un équipement. Toutes ces catégories
 * partagent la même forme (id, propriétaire, nom, date) ; le **type** n'est pas porté par
 * l'entité mais par la table/repository qui la stocke. Cela évite six entités quasi identiques.
 *
 * Immuable de l'extérieur (aucun setter). Le nom est porté par {@link ReferenceName} garantissant
 * sa validité ; la propriété est exprimée par {@link ReferenceItem.isOwnedBy}.
 */
export class ReferenceItem {
  /**
   * Constructeur privé : la création passe par {@link ReferenceItem.create} (nouvel élément)
   * ou {@link ReferenceItem.restore} (élément existant).
   *
   * @param props - L'instantané complet et déjà validé de l'élément.
   */
  private constructor(private readonly props: ReferenceItemSnapshot) {}

  /**
   * Crée un **nouvel** élément de référence dont l'utilisateur fourni est le propriétaire.
   *
   * @param params - Les données du nouvel élément.
   * @param params.id - Identifiant unique (généré en amont par un `IdGeneratorService`).
   * @param params.ownerId - Identifiant du propriétaire (l'utilisateur authentifié).
   * @param params.name - Nom de l'élément (value object déjà validé).
   * @param params.createdAt - Horodatage de création (injecté pour rester testable).
   * @returns Une nouvelle instance de `ReferenceItem`.
   */
  public static create(params: {
    id: string;
    ownerId: string;
    name: ReferenceName;
    createdAt: Date;
  }): ReferenceItem {
    return new ReferenceItem(params);
  }

  /**
   * Reconstruit un élément **existant** à partir d'un instantané (ex : ligne de BDD mappée).
   *
   * @param snapshot - L'état complet et déjà validé de l'élément.
   * @returns L'instance de `ReferenceItem` reconstruite.
   */
  public static restore(snapshot: ReferenceItemSnapshot): ReferenceItem {
    return new ReferenceItem(snapshot);
  }

  /** @returns L'identifiant unique de l'élément. */
  public get id(): string {
    return this.props.id;
  }

  /** @returns L'identifiant du propriétaire de l'élément. */
  public get ownerId(): string {
    return this.props.ownerId;
  }

  /** @returns Le nom de l'élément (value object). */
  public get name(): ReferenceName {
    return this.props.name;
  }

  /** @returns La date de création de l'élément. */
  public get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Indique si l'utilisateur donné est le **propriétaire** de cet élément. Les opérations
   * réservées au propriétaire (suppression, rattachement à une fiche) s'appuient sur cette règle.
   *
   * @param userId - L'identifiant de l'utilisateur à tester.
   * @returns `true` si l'utilisateur est le propriétaire, `false` sinon.
   */
  public isOwnedBy(userId: string): boolean {
    return this.props.ownerId === userId;
  }
}
