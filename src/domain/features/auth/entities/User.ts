/**
 * Données nécessaires pour reconstruire un `User` existant (ex : depuis la base).
 */
export interface UserSnapshot {
  /** Identifiant unique de l'utilisateur. */
  readonly id: string;
  /** Date de création du compte. */
  readonly createdAt: Date;
}

/**
 * Entité métier représentant l'**identité applicative** d'un utilisateur du système.
 *
 * Volontairement séparée des données d'authentification (portées par `Credential`) : le `User`
 * n'expose ni e-mail ni mot de passe. C'est ici qu'arriveront les futurs attributs métier du
 * JDR (pseudo, avatar, rôles de jeu…), sans jamais mélanger sécurité et domaine applicatif.
 *
 * L'entité est immuable de l'extérieur : aucun setter, accès en lecture seule.
 */
export class User {
  /**
   * Constructeur privé : la création passe par les factories {@link User.create}
   * (nouvel utilisateur) ou {@link User.restore} (utilisateur existant).
   *
   * @param props - L'instantané complet et déjà validé de l'utilisateur.
   */
  private constructor(private readonly props: UserSnapshot) {}

  /**
   * Crée un **nouvel** utilisateur métier (inscription).
   *
   * @param params - Identité du nouvel utilisateur.
   * @param params.id - Identifiant unique (généré en amont par un `IdGeneratorService`).
   * @param params.createdAt - Horodatage de création (injecté pour rester testable/déterministe).
   * @returns Une nouvelle instance de `User`.
   */
  public static create(params: { id: string; createdAt: Date }): User {
    return new User({ id: params.id, createdAt: params.createdAt });
  }

  /**
   * Reconstruit un utilisateur **existant** à partir d'un instantané (ex : ligne de BDD mappée).
   *
   * @param snapshot - L'état complet et déjà validé de l'utilisateur.
   * @returns L'instance de `User` reconstruite.
   */
  public static restore(snapshot: UserSnapshot): User {
    return new User(snapshot);
  }

  /** @returns L'identifiant unique de l'utilisateur. */
  public get id(): string {
    return this.props.id;
  }

  /** @returns La date de création du compte. */
  public get createdAt(): Date {
    return this.props.createdAt;
  }
}
