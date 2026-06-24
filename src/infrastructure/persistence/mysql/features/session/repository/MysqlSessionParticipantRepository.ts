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
}
