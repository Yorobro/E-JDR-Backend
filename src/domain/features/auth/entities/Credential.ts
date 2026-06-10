import { Email } from "@domain/features/auth/value-objects/Email";
import { HashedPassword } from "@domain/features/auth/value-objects/HashedPassword";

/**
 * Fonction de comparaison de mot de passe injectée dans {@link Credential.verifyPassword}.
 *
 * Délègue la cryptographie (bcrypt) à l'appelant pour que l'entité reste indépendante
 * de toute librairie. Typiquement fournie par le port `PasswordHasherService`.
 */
export type PasswordCompareFn = (plain: string, hash: string) => Promise<boolean>;

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
  /** Nombre de tentatives de connexion consécutives échouées. */
  readonly failedAttempts: number;
  /** Date jusqu'à laquelle le compte est verrouillé, ou `null` si non verrouillé. */
  readonly lockedUntil: Date | null;
}

/**
 * Entité métier portant les **données d'authentification** d'un compte : e-mail et empreinte
 * du mot de passe, reliées à un `User` métier (relation 1–1 via `userId`).
 *
 * Gère également la protection anti-brute-force : après {@link MAX_FAILED_ATTEMPTS} tentatives
 * consécutives échouées, le compte est verrouillé pour {@link LOCK_DURATION_MS} millisecondes.
 * Les méthodes mutantes retournent une **nouvelle instance** (immuabilité).
 */
export class Credential {
  /** Nombre de tentatives échouées déclenchant le verrouillage. */
  private static readonly MAX_FAILED_ATTEMPTS = 5;

  /** Durée de verrouillage après dépassement du seuil (15 minutes). */
  private static readonly LOCK_DURATION_MS = 15 * 60 * 1000;

  private constructor(private readonly props: CredentialSnapshot) {}

  /**
   * Crée un **nouvel** identifiant d'authentification (inscription).
   * Le compteur de tentatives et le verrouillage sont initialisés à zéro/null.
   */
  public static create(params: {
    id: string;
    userId: string;
    email: Email;
    password: HashedPassword;
    createdAt: Date;
  }): Credential {
    return new Credential({
      ...params,
      failedAttempts: 0,
      lockedUntil: null,
    });
  }

  /**
   * Reconstruit un identifiant **existant** à partir d'un instantané (ex : ligne de BDD mappée).
   */
  public static restore(snapshot: CredentialSnapshot): Credential {
    return new Credential(snapshot);
  }

  public get id(): string {
    return this.props.id;
  }
  public get userId(): string {
    return this.props.userId;
  }
  public get email(): Email {
    return this.props.email;
  }
  public get password(): HashedPassword {
    return this.props.password;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public get failedAttempts(): number {
    return this.props.failedAttempts;
  }
  public get lockedUntil(): Date | null {
    return this.props.lockedUntil;
  }

  /**
   * Indique si le compte est actuellement verrouillé.
   *
   * @param now - L'instant de référence (injecté pour rester testable).
   */
  public isLocked(now: Date): boolean {
    return this.props.lockedUntil !== null && now < this.props.lockedUntil;
  }

  /**
   * Enregistre une tentative de connexion échouée.
   * Si le seuil est atteint, verrouille le compte pour {@link LOCK_DURATION_MS} ms.
   *
   * @param now - L'instant de référence (injecté pour rester testable).
   * @returns Une nouvelle instance de `Credential` avec le compteur mis à jour.
   */
  public recordFailedAttempt(now: Date): Credential {
    const newCount = this.props.failedAttempts + 1;
    const lockedUntil =
      newCount >= Credential.MAX_FAILED_ATTEMPTS
        ? new Date(now.getTime() + Credential.LOCK_DURATION_MS)
        : this.props.lockedUntil;
    return new Credential({ ...this.props, failedAttempts: newCount, lockedUntil });
  }

  /**
   * Réinitialise le compteur de tentatives et supprime le verrouillage.
   * Appelé après une connexion réussie.
   *
   * @returns Une nouvelle instance de `Credential` avec le compteur remis à zéro.
   */
  public resetFailedAttempts(): Credential {
    return new Credential({ ...this.props, failedAttempts: 0, lockedUntil: null });
  }

  /**
   * Vérifie qu'un mot de passe en clair correspond au mot de passe haché de cet identifiant.
   *
   * @param plainPassword - Le mot de passe en clair à vérifier.
   * @param compare - Fonction de comparaison ({@link PasswordCompareFn}),
   *                  typiquement fournie par le port `PasswordHasherService`.
   */
  public async verifyPassword(plainPassword: string, compare: PasswordCompareFn): Promise<boolean> {
    return compare(plainPassword, this.props.password.value);
  }
}
