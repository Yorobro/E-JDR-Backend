import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";
import { SessionParticipantRepository } from "@application/features/session/abstractions/repositories/SessionParticipantRepository";
import { SessionParticipantDao } from "@infrastructure/persistence/mysql/features/session/dao/SessionParticipantDao";
import { SessionParticipantMapper } from "@infrastructure/persistence/mysql/features/session/mappers/SessionParticipantMapper";

/**
 * Implémentation MySQL du port `SessionParticipantRepository`.
 *
 * Rôle d'**assemblage** : délègue le SQL au `SessionParticipantDao`, puis traduit via le
 * `SessionParticipantMapper`. Aucune requête SQL n'est écrite ici.
 */
export class MysqlSessionParticipantRepository implements SessionParticipantRepository {
  /**
   * @param dao - DAO de la table `session_participants` (SQL pur).
   */
  constructor(private readonly dao: SessionParticipantDao) {}

  /**
   * @inheritdoc
   */
  public async saveMany(participants: SessionParticipant[]): Promise<void> {
    await this.dao.insertMany(participants.map(SessionParticipantMapper.toRow));
  }

  /**
   * @inheritdoc
   */
  public async findBySessionId(sessionId: string): Promise<SessionParticipant[]> {
    const rows = await this.dao.findBySessionId(sessionId);
    return rows.map((row) => SessionParticipantMapper.toDomain(row));
  }

  /**
   * @inheritdoc
   */
  public async findBySessionIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<SessionParticipant | null> {
    const row = await this.dao.findBySessionIdAndUserId(sessionId, userId);
    return row === null ? null : SessionParticipantMapper.toDomain(row);
  }

  /**
   * @inheritdoc
   */
  public async update(participant: SessionParticipant): Promise<void> {
    await this.dao.update({
      session_id: participant.sessionId,
      user_id: participant.userId,
      status: participant.status.value,
      responded_at: participant.respondedAt,
    });
  }

  /**
   * @inheritdoc
   */
  public async findInvitedByUserId(userId: string): Promise<SessionParticipant[]> {
    const rows = await this.dao.findInvitedByUserId(userId);
    return rows.map((row) => SessionParticipantMapper.toDomain(row));
  }

  /**
   * Supprime la participation d'un joueur à une session (identité composite `(sessionId, userId)`).
   *
   * @param sessionId L'identifiant de la session.
   * @param userId L'identifiant du joueur.
   */
  public async deleteBySessionIdAndUserId(sessionId: string, userId: string): Promise<void> {
    await this.dao.deleteById(sessionId, userId);
  }
}
