import { ReferenceName } from "@domain/features/reference/value-objects/ReferenceName";

/**
 * Données nécessaires pour reconstruire un `ReferenceItem` existant (ex : depuis la base).
 * Le nom est déjà un value object validé via {@link ReferenceName}.
 */
export interface ReferenceItemSnapshot {
  /** Identifiant unique de l'élément. */
  readonly id: string;
  /** Identifiant du **groupe d'amis** propriétaire de l'élément (catalogue partagé du groupe). */
  readonly groupId: string;
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
 * sa validité ; la propriété est exprimée par {@link ReferenceItem.isInGroup}.
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
   * Crée un **nouvel** élément de référence appartenant au groupe fourni.
   *
   * @param params - Les données du nouvel élément.
   * @param params.id - Identifiant unique (généré en amont par un `IdGeneratorService`).
   * @param params.groupId - Identifiant du groupe propriétaire.
   * @param params.name - Nom de l'élément (value object déjà validé).
   * @param params.createdAt - Horodatage de création (injecté pour rester testable).
   * @returns Une nouvelle instance de `ReferenceItem`.
   */
  public static create(params: {
    id: string;
    groupId: string;
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

  /** @returns L'identifiant du groupe d'amis propriétaire de l'élément. */
  public get groupId(): string {
    return this.props.groupId;
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
   * Indique si le groupe donné est le **propriétaire** de cet élément.
   *
   * @param groupId - L'identifiant du groupe à tester.
   * @returns `true` si le groupe est propriétaire, `false` sinon.
   */
  public isInGroup(groupId: string): boolean {
    return this.props.groupId === groupId;
  }
}
