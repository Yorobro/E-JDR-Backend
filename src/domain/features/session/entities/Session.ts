import { SessionTitle } from "@domain/features/session/value-objects/SessionTitle";
import { SessionStatus } from "@domain/features/session/value-objects/SessionStatus";
import { SessionNotLaunchableError } from "@domain/features/session/errors/SessionNotLaunchableError";
import { SessionNotStartableError } from "@domain/features/session/errors/SessionNotStartableError";

/**
 * Données nécessaires pour reconstruire une `Session` existante (ex : depuis la base).
 * Le titre est déjà un value object validé via {@link SessionTitle}, le statut via
 * {@link SessionStatus}.
 */
export interface SessionSnapshot {
  /** Identifiant unique de la session. */
  readonly id: string;
  /** Identifiant de la campagne à laquelle appartient la session. */
  readonly campaignId: string;
  /** Titre de la session (value object garantissant la validité). */
  readonly title: SessionTitle;
  /** Date à laquelle la session a (ou aura) lieu. */
  readonly date: Date;
  /** Date de création de l'enregistrement. */
  readonly createdAt: Date;
  /** Statut courant dans le cycle de vie (PLANNED → LOBBY → ACTIVE → ENDED). */
  readonly status: SessionStatus;
  /** Horodatage du démarrage effectif de la partie ; `null` tant que la session n'est pas ACTIVE. */
  readonly startedAt: Date | null;
}

/**
 * Entité métier représentant une **session de jeu** : une rencontre de jeu rattachée à une
 * campagne. Une campagne possède plusieurs sessions (relation 1‑N) ; une session appartient
 * à exactement une campagne (`campaignId`).
 *
 * L'entité est immuable de l'extérieur : aucun setter, accès en lecture seule. Les transitions
 * de cycle de vie (`openLobby`, `start`) ne mutent pas l'instance mais renvoient une **copie**
 * dans le nouvel état, en validant l'invariant de la machine à états ({@link SessionStatus}).
 * L'autorisation (qui peut gérer la session) n'est pas portée ici : elle découle du MJ de la
 * campagne parente, vérifié au niveau des use cases.
 */
export class Session {
  /**
   * Constructeur privé : la création passe par les factories {@link Session.create}
   * (nouvelle session) ou {@link Session.restore} (session existante).
   *
   * @param props - L'instantané complet et déjà validé de la session.
   */
  private constructor(private readonly props: SessionSnapshot) {}

  /**
   * Crée une **nouvelle** session rattachée à la campagne donnée.
   *
   * Une session naît toujours au statut `PLANNED`, sans date de démarrage : ces invariants
   * sont posés ici et ne peuvent pas être contournés par l'appelant.
   *
   * @param params - Les données de la nouvelle session.
   * @param params.id - Identifiant unique (généré en amont par un `IdGeneratorService`).
   * @param params.campaignId - Identifiant de la campagne parente.
   * @param params.title - Titre de la session (value object déjà validé).
   * @param params.date - Date de la session (injectée, déjà parsée).
   * @param params.createdAt - Horodatage de création (injecté pour rester testable/déterministe).
   * @returns Une nouvelle instance de `Session` au statut `PLANNED`.
   */
  public static create(params: {
    id: string;
    campaignId: string;
    title: SessionTitle;
    date: Date;
    createdAt: Date;
  }): Session {
    return new Session({
      ...params,
      status: SessionStatus.PLANNED,
      startedAt: null,
    });
  }

  /**
   * Reconstruit une session **existante** à partir d'un instantané (ex : ligne de BDD mappée).
   *
   * @param snapshot - L'état complet et déjà validé de la session.
   * @returns L'instance de `Session` reconstruite.
   */
  public static restore(snapshot: SessionSnapshot): Session {
    return new Session(snapshot);
  }

  /** @returns L'identifiant unique de la session. */
  public get id(): string {
    return this.props.id;
  }

  /** @returns L'identifiant de la campagne parente. */
  public get campaignId(): string {
    return this.props.campaignId;
  }

  /** @returns Le titre de la session (value object). */
  public get title(): SessionTitle {
    return this.props.title;
  }

  /** @returns La date à laquelle la session a (ou aura) lieu. */
  public get date(): Date {
    return this.props.date;
  }

  /** @returns La date de création de l'enregistrement. */
  public get createdAt(): Date {
    return this.props.createdAt;
  }

  /** @returns Le statut courant de la session (value object). */
  public get status(): SessionStatus {
    return this.props.status;
  }

  /** @returns L'horodatage de démarrage de la partie, ou `null` si elle n'est pas encore ACTIVE. */
  public get startedAt(): Date | null {
    return this.props.startedAt;
  }

  /**
   * Retourne une **copie** de la session avec un nouveau titre et/ou une nouvelle date.
   *
   * L'immuabilité est préservée : on ne mute pas l'instance, on en renvoie une nouvelle
   * (mêmes `id`, `campaignId`, `createdAt`, `status`, `startedAt`). Utilisé par le use case
   * de mise à jour.
   *
   * @param params.title - Le nouveau titre (value object déjà validé).
   * @param params.date - La nouvelle date de session.
   * @returns Une nouvelle instance de `Session` mise à jour.
   */
  public withDetails(params: { title: SessionTitle; date: Date }): Session {
    return new Session({
      ...this.props,
      title: params.title,
      date: params.date,
    });
  }

  /**
   * Ouvre le **lobby** de la session : transition `PLANNED → LOBBY`.
   *
   * C'est l'étape déclenchée quand le MJ lance la session et invite des joueurs. La règle
   * métier « on ne peut ouvrir le lobby que depuis PLANNED » est garantie ici, pas dans le
   * use case.
   *
   * @returns Une nouvelle instance de `Session` au statut `LOBBY`.
   * @throws {SessionNotLaunchableError} Si la session n'est pas au statut `PLANNED`.
   */
  public openLobby(): Session {
    if (!this.props.status.isPlanned()) {
      throw new SessionNotLaunchableError(this.props.status.value);
    }
    return new Session({ ...this.props, status: SessionStatus.LOBBY });
  }

  /**
   * Démarre réellement la partie : transition `LOBBY → ACTIVE`, en horodatant le départ.
   *
   * Déclenchée quand le MJ confirme que tous les joueurs sont présents.
   *
   * @param params.startedAt - L'horodatage du démarrage (injecté pour rester déterministe).
   * @returns Une nouvelle instance de `Session` au statut `ACTIVE` avec `startedAt` renseigné.
   * @throws {SessionNotStartableError} Si la session n'est pas au statut `LOBBY`.
   */
  public start(params: { startedAt: Date }): Session {
    if (!this.props.status.isLobby()) {
      throw new SessionNotStartableError(this.props.status.value);
    }
    return new Session({
      ...this.props,
      status: SessionStatus.ACTIVE,
      startedAt: params.startedAt,
    });
  }
}
