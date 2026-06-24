import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";
import { SessionParticipantStatus } from "@domain/features/session/value-objects/SessionParticipantStatus";
import {
  SessionParticipantRow,
  SessionParticipantInsert,
} from "@infrastructure/persistence/mysql/features/session/dao/SessionParticipantDao";

/**
 * Traduit entre la représentation **persistance** (`SessionParticipantRow`) et l'**entité
 * domaine** (`SessionParticipant`).
 *
 * En lecture, le statut stocké (réputé valide) est ré-encapsulé dans un `SessionParticipantStatus`
 * et les dates (`datetime`) reconstruites ; en écriture, les value objects sont déballés vers des
 * valeurs brutes. Mapper sans état.
 */
export class SessionParticipantMapper {
  /**
   * Convertit une ligne SQL brute en entité domaine `SessionParticipant`.
   *
   * @param row - La ligne `session_participants` issue de la base.
   * @returns L'entité reconstruite.
   */
  public static toDomain(row: SessionParticipantRow): SessionParticipant {
    return SessionParticipant.restore({
      sessionId: row.session_id,
      userId: row.user_id,
      characterSheetId: row.character_sheet_id,
      status: SessionParticipantStatus.create(row.status),
      invitedAt: new Date(row.invited_at),
      respondedAt: row.responded_at === null ? null : new Date(row.responded_at),
    });
  }

  /**
   * Convertit une entité domaine `SessionParticipant` en valeurs de colonnes prêtes à insérer.
   *
   * @param participant - L'entité à persister.
   * @returns Un objet dont les clés correspondent aux colonnes de `session_participants`.
   */
  public static toRow(participant: SessionParticipant): SessionParticipantInsert {
    return {
      session_id: participant.sessionId,
      user_id: participant.userId,
      character_sheet_id: participant.characterSheetId,
      status: participant.status.value,
      invited_at: participant.invitedAt,
      responded_at: participant.respondedAt,
    };
  }
}
