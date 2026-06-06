import { Email } from "@domain/auth/value-objects/Email";
import { HashedPassword } from "@domain/auth/value-objects/HashedPassword";

/**
 * Données nécessaires pour reconstruire un `User` existant (ex : depuis la base).
 * Toutes les valeurs sont déjà validées/typées via les value objects.
 */
export interface UserSnapshot {
  /** Identifiant unique de l'utilisateur. */
  readonly id: string;
  /** Adresse e-mail (value object garantissant la validité). */
  readonly email: Email;
  /** Mot de passe haché (value object garantissant qu'il n'est jamais en clair). */
  readonly password: HashedPassword;
  /** Date de création du compte. */
  readonly createdAt: Date;
}

/**
 * Entité métier **riche** représentant un utilisateur du système.
 *
 * Le `User` encapsule ses invariants et expose un comportement métier, plutôt qu'un simple
 * sac de propriétés. Il est immuable de l'extérieur : aucun setter, accès en lecture seule.
 *
 * Il ne dépend d'aucune technologie (pas de bcrypt, pas de SQL) : la vérification du mot de
 * passe est déléguée via un comparateur fourni par l'appelant, ce qui garde le domaine pur.
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
   * Crée un **nouvel** utilisateur (inscription).
   *
   * Les invariants de format (e-mail valide, mot de passe haché) sont déjà portés par
   * les value objects passés en paramètres ; cette factory existe pour exprimer
   * l'intention métier « créer un nouveau compte » et fixer la date de création.
   *
   * @param params - Identité et identifiants du nouvel utilisateur.
   * @param params.id - Identifiant unique (généré en amont par un `IIdGenerator`).
   * @param params.email - Adresse e-mail validée.
   * @param params.password - Mot de passe déjà haché.
   * @param params.createdAt - Horodatage de création (injecté pour rester testable/déterministe).
   * @returns Une nouvelle instance de `User`.
   */
  public static create(params: {
    id: string;
    email: Email;
    password: HashedPassword;
    createdAt: Date;
  }): User {
    return new User({
      id: params.id,
      email: params.email,
      password: params.password,
      createdAt: params.createdAt,
    });
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

  /** @returns L'adresse e-mail (value object) de l'utilisateur. */
  public get email(): Email {
    return this.props.email;
  }

  /** @returns Le mot de passe haché (value object) de l'utilisateur. */
  public get password(): HashedPassword {
    return this.props.password;
  }

  /** @returns La date de création du compte. */
  public get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Vérifie qu'un mot de passe en clair correspond au mot de passe haché de cet utilisateur.
   *
   * La comparaison effective (algorithme de hachage) est déléguée à l'appelant via la fonction
   * `compare`, afin que l'entité reste indépendante de toute librairie de cryptographie.
   *
   * @param plainPassword - Le mot de passe en clair à vérifier.
   * @param compare - Fonction de comparaison `(clair, empreinte) => Promise<boolean>`,
   *                  typiquement fournie par le port `IPasswordHasher`.
   * @returns `true` si le mot de passe correspond, `false` sinon.
   */
  public async verifyPassword(
    plainPassword: string,
    compare: (plain: string, hash: string) => Promise<boolean>,
  ): Promise<boolean> {
    return compare(plainPassword, this.props.password.value);
  }
}
