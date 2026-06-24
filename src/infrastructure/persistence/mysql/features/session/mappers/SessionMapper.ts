import { Session } from "@domain/features/session/entities/Session";
import { SessionTitle } from "@domain/features/session/value-objects/SessionTitle";
import { SessionStatus } from "@domain/features/session/value-objects/SessionStatus";
import { SessionRow } from "@infrastructure/persistence/mysql/features/session/dao/SessionDao";

/**
 * Traduit entre la représentation **persistance** (`SessionRow`) et l'**entité domaine**
 * (`Session`).
 *
 * En lecture, le titre stocké (réputé déjà valide) est ré-encapsulé dans un `SessionTitle` ;
 * en écriture, le VO est déballé vers une chaîne brute pour la colonne `title`. La `date` est
 * un `Date` des deux côtés (colonne `datetime`). Mapper sans état.
 */
export class SessionMapper {
  /**
   * Convertit une ligne SQL brute en entité domaine `Session`.
   *
   * @param row - La ligne `sessions` issue de la base.
   * @returns L'entité `Session` reconstruite.
   */
  public static toDomain(row: SessionRow): Session {
    return Session.restore({
      id: row.id,
      campaignId: row.campaign_id,
      title: SessionTitle.create(row.title),
      date: new Date(row.date),
      createdAt: new Date(row.created_at),
      status: SessionStatus.create(row.status),
      startedAt: row.started_at === null ? null : new Date(row.started_at),
    });
  }

  /**
   * Convertit une entité domaine `Session` en valeurs de colonnes prêtes pour l'insertion.
   *
   * @param session - L'entité `Session` à persister.
   * @returns Un objet dont les clés correspondent aux colonnes de la table `sessions`.
   */
  public static toRow(session: Session): {
    id: string;
    campaign_id: string;
    title: string;
    date: Date;
    created_at: Date;
  } {
    return {
      id: session.id,
      campaign_id: session.campaignId,
      title: session.title.value,
      date: session.date,
      created_at: session.createdAt,
    };
  }
}
