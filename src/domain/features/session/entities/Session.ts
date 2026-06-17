import { SessionTitle } from "@domain/features/session/value-objects/SessionTitle";

/**
 * Données nécessaires pour reconstruire une `Session` existante (ex : depuis la base).
 * Le titre est déjà un value object validé via {@link SessionTitle}.
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
}

/**
 * Entité métier représentant une **session de jeu** : une rencontre de jeu rattachée à une
 * campagne. Une campagne possède plusieurs sessions (relation 1‑N) ; une session appartient
 * à exactement une campagne (`campaignId`).
 *
 * L'entité est immuable de l'extérieur : aucun setter, accès en lecture seule. Le titre est
 * porté par un value object {@link SessionTitle} qui garantit sa validité à la construction.
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
   * @param params - Les données de la nouvelle session.
   * @param params.id - Identifiant unique (généré en amont par un `IdGeneratorService`).
   * @param params.campaignId - Identifiant de la campagne parente.
   * @param params.title - Titre de la session (value object déjà validé).
   * @param params.date - Date de la session (injectée, déjà parsée).
   * @param params.createdAt - Horodatage de création (injecté pour rester testable/déterministe).
   * @returns Une nouvelle instance de `Session`.
   */
  public static create(params: {
    id: string;
    campaignId: string;
    title: SessionTitle;
    date: Date;
    createdAt: Date;
  }): Session {
    return new Session(params);
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

  /**
   * Retourne une **copie** de la session avec un nouveau titre et/ou une nouvelle date.
   *
   * L'immuabilité est préservée : on ne mute pas l'instance, on en renvoie une nouvelle
   * (mêmes `id`, `campaignId`, `createdAt`). Utilisé par le use case de mise à jour.
   *
   * @param params.title - Le nouveau titre (value object déjà validé).
   * @param params.date - La nouvelle date de session.
   * @returns Une nouvelle instance de `Session` mise à jour.
   */
  public withDetails(params: { title: SessionTitle; date: Date }): Session {
    return new Session({
      id: this.props.id,
      campaignId: this.props.campaignId,
      title: params.title,
      date: params.date,
      createdAt: this.props.createdAt,
    });
  }
}
