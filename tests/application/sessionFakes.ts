import { Session } from "@domain/features/session/entities/Session";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";
import { SessionParticipantRepository } from "@application/features/session/abstractions/repositories/SessionParticipantRepository";

/**
 * Doublures de test (fakes) de la feature session.
 *
 * Extraites de `fakes.ts` (taille de fichier) et re-exportées par celui-ci pour que les tests
 * les importent depuis `./fakes` comme les autres.
 */

/** Repository de sessions en mémoire (indexé par id). */
export class FakeSessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();

  public async save(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  public async update(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  public async findByCampaignId(campaignId: string): Promise<Session[]> {
    return [...this.sessions.values()]
      .filter((session) => session.campaignId === campaignId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  public async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  /** Aide de test : pré-remplit le repository avec une session. */
  public seed(session: Session): void {
    this.sessions.set(session.id, session);
  }
}

/** Repository de participations de session en mémoire. */
export class FakeSessionParticipantRepository implements SessionParticipantRepository {
  public readonly participants: SessionParticipant[] = [];

  public async saveMany(participants: SessionParticipant[]): Promise<void> {
    this.participants.push(...participants);
  }

  public async findBySessionId(sessionId: string): Promise<SessionParticipant[]> {
    return this.participants.filter((participant) => participant.sessionId === sessionId);
  }
}
