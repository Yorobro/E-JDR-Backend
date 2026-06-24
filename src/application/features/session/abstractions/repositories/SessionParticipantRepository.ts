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
}
