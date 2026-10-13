import { SessionParticipantStatus } from "@domain/features/session/value-objects/SessionParticipantStatus";
import { ParticipantAlreadyRespondedError } from "@domain/features/session/errors/ParticipantAlreadyRespondedError";
import { ParticipantAlreadyInLobbyError } from "@domain/features/session/errors/ParticipantAlreadyInLobbyError";

/**
 * Données nécessaires pour reconstruire un `SessionParticipant` existant (ex : depuis la base).
 * Le statut est déjà un value object validé via {@link SessionParticipantStatus}.
 */
export interface SessionParticipantSnapshot {
  /** Identifiant de la session à laquelle se rapporte la participation. */
  readonly sessionId: string;
  /** Identifiant de l'utilisateur invité. */
  readonly userId: string;
  /** État de la participation (INVITED → ACCEPTED / REFUSED). */
  readonly status: SessionParticipantStatus;
  /** Horodatage de l'envoi de l'invitation. */
  readonly invitedAt: Date;
  /** Horodatage de la réponse du joueur ; `null` tant qu'il n'a pas répondu. */
  readonly respondedAt: Date | null;
}

/**
 * Entité métier représentant la **participation d'un joueur à une session** : le lien entre un
 * utilisateur invité et la session, avec son état d'invitation et la fiche qu'il a choisie.
 *
 * Identité composite `(sessionId, userId)` : un utilisateur figure au plus une fois par session
 * (aligné sur la clé primaire de `session_participants`). Comme les autres entités du domaine,
 * elle est immuable : les transitions (`accept`, `refuse`, `reinvite`) renvoient une copie dans
 * le nouvel état plutôt que de muter l'instance, et valident l'invariant « on ne répond qu'une
 * fois » (seul un refus peut être réarmé par le MJ).
 */
export class SessionParticipant {
  /**
   * Constructeur privé : la création passe par {@link SessionParticipant.create}
   * (nouvelle invitation) ou {@link SessionParticipant.restore} (participation existante).
   *
   * @param props - L'instantané complet et déjà validé de la participation.
   */
  private constructor(private readonly props: SessionParticipantSnapshot) {}

  /**
   * Crée une **nouvelle** invitation pour un joueur, au statut `INVITED`.
   *
   * Le joueur n'a pas encore répondu (`respondedAt` à `null`) : cet invariant est posé ici.
   *
   * @param params.sessionId - La session concernée.
   * @param params.userId - L'utilisateur invité.
   * @param params.invitedAt - Horodatage de l'invitation (injecté pour rester déterministe).
   * @returns Une nouvelle participation au statut `INVITED`.
   */
  public static create(params: {
    sessionId: string;
    userId: string;
    invitedAt: Date;
  }): SessionParticipant {
    return new SessionParticipant({
      sessionId: params.sessionId,
      userId: params.userId,
      status: SessionParticipantStatus.INVITED,
      invitedAt: params.invitedAt,
      respondedAt: null,
    });
  }

  /**
   * Reconstruit une participation **existante** à partir d'un instantané (ligne de BDD mappée).
   *
   * @param snapshot - L'état complet et déjà validé de la participation.
   * @returns L'instance reconstruite.
   */
  public static restore(snapshot: SessionParticipantSnapshot): SessionParticipant {
    return new SessionParticipant(snapshot);
  }

  /** @returns L'identifiant de la session. */
  public get sessionId(): string {
    return this.props.sessionId;
  }

  /** @returns L'identifiant de l'utilisateur invité. */
  public get userId(): string {
    return this.props.userId;
  }

  /** @returns L'état de la participation (value object). */
  public get status(): SessionParticipantStatus {
    return this.props.status;
  }

  /** @returns L'horodatage de l'invitation. */
  public get invitedAt(): Date {
    return this.props.invitedAt;
  }

  /** @returns L'horodatage de la réponse, ou `null` si le joueur n'a pas répondu. */
  public get respondedAt(): Date | null {
    return this.props.respondedAt;
  }

  /**
   * Accepte l'invitation : `INVITED → ACCEPTED`.
   *
   * La fiche du joueur n'est pas stockée ici : elle se déduit de la campagne de la session et
   * du joueur (une seule fiche par campagne).
   *
   * @param params.respondedAt - Horodatage de la réponse (injecté pour rester déterministe).
   * @returns Une nouvelle participation au statut `ACCEPTED`.
   * @throws {ParticipantAlreadyRespondedError} Si le joueur a déjà répondu (statut ≠ `INVITED`).
   */
  public accept(params: { respondedAt: Date }): SessionParticipant {
    if (!this.props.status.isInvited()) {
      throw new ParticipantAlreadyRespondedError(this.props.status.value);
    }
    return new SessionParticipant({
      ...this.props,
      status: SessionParticipantStatus.ACCEPTED,
      respondedAt: params.respondedAt,
    });
  }

  /**
   * Réinvite un joueur qui avait **refusé** : `REFUSED → INVITED`, en réarmant l'invitation.
   *
   * Sert au refus accidentel : le MJ le reconvie depuis le salon d'attente et le joueur repart
   * en attente de réponse (`respondedAt` remis à `null`, nouvelle date d'invitation). La règle
   * « on ne réinvite qu'un refus » vit ici : un joueur encore `INVITED` ou déjà `ACCEPTED` est
   * déjà dans le lobby, il n'y a rien à réinviter.
   *
   * @param params.invitedAt - Horodatage de la nouvelle invitation (injecté pour rester déterministe).
   * @returns Une nouvelle participation au statut `INVITED`.
   * @throws {ParticipantAlreadyInLobbyError} Si la participation n'est pas au statut `REFUSED`.
   */
  public reinvite(params: { invitedAt: Date }): SessionParticipant {
    if (!this.props.status.isRefused()) {
      throw new ParticipantAlreadyInLobbyError(this.props.status.value);
    }
    return new SessionParticipant({
      ...this.props,
      status: SessionParticipantStatus.INVITED,
      invitedAt: params.invitedAt,
      respondedAt: null,
    });
  }

  /**
   * Refuse l'invitation : `INVITED → REFUSED`.
   *
   * @param params.respondedAt - Horodatage de la réponse (injecté pour rester déterministe).
   * @returns Une nouvelle participation au statut `REFUSED`.
   * @throws {ParticipantAlreadyRespondedError} Si le joueur a déjà répondu (statut ≠ `INVITED`).
   */
  public refuse(params: { respondedAt: Date }): SessionParticipant {
    if (!this.props.status.isInvited()) {
      throw new ParticipantAlreadyRespondedError(this.props.status.value);
    }
    return new SessionParticipant({
      ...this.props,
      status: SessionParticipantStatus.REFUSED,
      respondedAt: params.respondedAt,
    });
  }
}
