import { Session } from "@domain/features/session/entities/Session";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionDao } from "@infrastructure/persistence/mysql/features/session/dao/SessionDao";
import { SessionMapper } from "@infrastructure/persistence/mysql/features/session/mappers/SessionMapper";

/**
 * Implémentation MySQL du port `SessionRepository`.
 *
 * Rôle d'**assemblage** : délègue le SQL au `SessionDao`, puis traduit les lignes brutes en
 * entités domaine via le `SessionMapper`. Aucune requête SQL n'est écrite ici.
 */
export class MysqlSessionRepository implements SessionRepository {
  /**
   * @param sessionDao - DAO de la table `sessions` (SQL pur).
   */
  constructor(private readonly sessionDao: SessionDao) {}

  /**
   * @inheritdoc
   */
  public async save(session: Session): Promise<void> {
    await this.sessionDao.insert(SessionMapper.toRow(session));
  }

  /**
   * @inheritdoc
   */
  public async update(session: Session): Promise<void> {
    await this.sessionDao.update({
      id: session.id,
      title: session.title.value,
      date: session.date,
      status: session.status.value,
      started_at: session.startedAt,
    });
  }

  /**
   * @inheritdoc
   */
  public async findByCampaignId(campaignId: string): Promise<Session[]> {
    const rows = await this.sessionDao.findByCampaignId(campaignId);
    return rows.map((row) => SessionMapper.toDomain(row));
  }

  /**
   * @inheritdoc
   */
  public async findById(id: string): Promise<Session | null> {
    const row = await this.sessionDao.findById(id);
    return row === null ? null : SessionMapper.toDomain(row);
  }

  /**
   * @inheritdoc
   */
  public async deleteById(id: string): Promise<void> {
    await this.sessionDao.deleteById(id);
  }
}
