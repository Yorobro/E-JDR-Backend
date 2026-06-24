import { SessionParticipantStatus } from "@domain/features/session/value-objects/SessionParticipantStatus";
import { ParticipantAlreadyRespondedError } from "@domain/features/session/errors/ParticipantAlreadyRespondedError";

/**
 * Données nécessaires pour reconstruire un `SessionParticipant` existant (ex : depuis la base).
 * Le statut est déjà un value object validé via {@link SessionParticipantStatus}.
 */
export interface SessionParticipantSnapshot {
  /** Identifiant de la session à laquelle se rapporte la participation. */
  readonly sessionId: string;
  /** Identifiant de l'utilisateur invité. */
  readonly userId: string;
  /**
   * Fiche de personnage choisie par le joueur en rejoignant le lobby ; `null` tant qu'il n'a
   * pas accepté (ou si la fiche a été supprimée depuis — la colonne est `ON DELETE SET NULL`).
   */
  readonly characterSheetId: string | null;
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
 * elle est immuable : les transitions (`accept`, `refuse`) renvoient une copie dans le nouvel
 * état plutôt que de muter l'instance, et valident l'invariant « on ne répond qu'une fois ».
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
   * Aucune fiche n'est encore choisie (`characterSheetId` à `null`) et le joueur n'a pas
   * répondu (`respondedAt` à `null`) : ces invariants sont posés ici.
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
      characterSheetId: null,
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

  /** @returns L'identifiant de la fiche choisie, ou `null` si aucune. */
  public get characterSheetId(): string | null {
    return this.props.characterSheetId;
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
   * Accepte l'invitation en choisissant une fiche de personnage : `INVITED → ACCEPTED`.
   *
   * @param params.characterSheetId - La fiche avec laquelle le joueur rejoint la session.
   * @param params.respondedAt - Horodatage de la réponse (injecté pour rester déterministe).
   * @returns Une nouvelle participation au statut `ACCEPTED`.
   * @throws {ParticipantAlreadyRespondedError} Si le joueur a déjà répondu (statut ≠ `INVITED`).
   */
  public accept(params: { characterSheetId: string; respondedAt: Date }): SessionParticipant {
    if (!this.props.status.isInvited()) {
      throw new ParticipantAlreadyRespondedError(this.props.status.value);
    }
    return new SessionParticipant({
      ...this.props,
      characterSheetId: params.characterSheetId,
      status: SessionParticipantStatus.ACCEPTED,
      respondedAt: params.respondedAt,
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
