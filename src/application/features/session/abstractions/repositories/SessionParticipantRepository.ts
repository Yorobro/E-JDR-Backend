import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";

/**
 * Port « out » d'accès aux participations de session.
 *
 * La couche application dépend de cette interface ; l'implémentation concrète (MySQL) vit dans
 * l'infrastructure. Les écritures passent par le `UnitOfWork` (repo lié à la transaction).
 */
export interface SessionParticipantRepository {
  /**
   * Persiste un lot de nouvelles participations (insertion en masse).
   *
   * @param participants - Les participations à enregistrer. Un appel vide est sans effet.
   */
  saveMany(participants: SessionParticipant[]): Promise<void>;

  /**
   * Récupère toutes les participations d'une session.
   *
   * @param sessionId - Identifiant de la session.
   * @returns La liste des participations (vide si aucune).
   */
  findBySessionId(sessionId: string): Promise<SessionParticipant[]>;

  /**
   * Récupère la participation d'un joueur donné à une session (identité composite).
   *
   * @param sessionId - Identifiant de la session.
   * @param userId - Identifiant du joueur.
   * @returns La participation, ou `null` si le joueur n'a pas été convié à cette session.
   */
  findBySessionIdAndUserId(sessionId: string, userId: string): Promise<SessionParticipant | null>;

  /**
   * Persiste l'état d'une participation **existante** (identité composite `(sessionId, userId)`).
   * Utilisé pour enregistrer la réponse d'un joueur (`ACCEPTED` / `REFUSED`).
   *
   * @param participant - La participation dans son nouvel état.
   */
  update(participant: SessionParticipant): Promise<void>;

  /**
   * Récupère les participations **en attente de réponse** (statut `INVITED`) d'un joueur donné,
   * toutes sessions confondues. Sert à lister ses invitations de session en attente.
   *
   * @param userId - Identifiant du joueur.
   * @returns Ses participations au statut `INVITED` (vide si aucune).
   */
  findInvitedByUserId(userId: string): Promise<SessionParticipant[]>;
}
