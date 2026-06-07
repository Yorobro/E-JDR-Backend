import { Email } from "@domain/auth/value-objects/Email";
import { HashedPassword } from "@domain/auth/value-objects/HashedPassword";

/**
 * Données nécessaires pour reconstruire un `Credential` existant (ex : depuis la base).
 * Toutes les valeurs sont déjà validées/typées via les value objects.
 */
export interface CredentialSnapshot {
  /** Identifiant unique de l'enregistrement d'authentification. */
  readonly id: string;
  /** Identifiant de l'utilisateur métier rattaché (relation 1–1). */
  readonly userId: string;
  /** Adresse e-mail (value object garantissant la validité). */
  readonly email: Email;
  /** Mot de passe haché (value object garantissant qu'il n'est jamais en clair). */
  readonly password: HashedPassword;
  /** Date de création de l'identifiant. */
  readonly createdAt: Date;
}

/**
 * Entité métier portant les **données d'authentification** d'un compte : e-mail et empreinte
 * du mot de passe, reliées à un `User` métier (relation 1–1 via `userId`).
 *
 * Cette séparation isole l'authentification (`Credential`) de l'identité applicative (`User`) :
 * le métier (profil JDR) évolue sans toucher au modèle de sécurité, et inversement.
 *
 * L'entité est immuable de l'extérieur et indépendante de toute technologie : la vérification
 * du mot de passe est déléguée via un comparateur fourni par l'appelant.
 */
export class Credential {
  /**
   * Constructeur privé : la création passe par les factories {@link Credential.create}
   * (nouveau compte) ou {@link Credential.restore} (compte existant).
   *
   * @param props - L'instantané complet et déjà validé de l'identifiant.
   */
  private constructor(private readonly props: CredentialSnapshot) {}

  /**
   * Crée un **nouvel** identifiant d'authentification (inscription).
   *
   * @param params - Données de l'identifiant à créer.
   * @param params.id - Identifiant unique de l'enregistrement (généré par un `IIdGenerator`).
   * @param params.userId - Identifiant de l'utilisateur métier rattaché.
   * @param params.email - Adresse e-mail validée.
   * @param params.password - Mot de passe déjà haché.
   * @param params.createdAt - Horodatage de création (injecté pour rester testable/déterministe).
   * @returns Une nouvelle instance de `Credential`.
   */
  public static create(params: {
    id: string;
    userId: string;
    email: Email;
    password: HashedPassword;
    createdAt: Date;
  }): Credential {
    return new Credential({
      id: params.id,
      userId: params.userId,
      email: params.email,
      password: params.password,
      createdAt: params.createdAt,
    });
  }

  /**
   * Reconstruit un identifiant **existant** à partir d'un instantané (ex : ligne de BDD mappée).
   *
   * @param snapshot - L'état complet et déjà validé de l'identifiant.
   * @returns L'instance de `Credential` reconstruite.
   */
  public static restore(snapshot: CredentialSnapshot): Credential {
    return new Credential(snapshot);
  }

  /** @returns L'identifiant unique de l'enregistrement d'authentification. */
  public get id(): string {
    return this.props.id;
  }

  /** @returns L'identifiant de l'utilisateur métier rattaché. */
  public get userId(): string {
    return this.props.userId;
  }

  /** @returns L'adresse e-mail (value object). */
  public get email(): Email {
    return this.props.email;
  }

  /** @returns Le mot de passe haché (value object). */
  public get password(): HashedPassword {
    return this.props.password;
  }

  /** @returns La date de création de l'identifiant. */
  public get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Vérifie qu'un mot de passe en clair correspond au mot de passe haché de cet identifiant.
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
