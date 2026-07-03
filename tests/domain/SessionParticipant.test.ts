import { describe, it, expect } from "vitest";
import { SessionParticipant } from "@domain/features/session/entities/SessionParticipant";
import { SessionParticipantStatus } from "@domain/features/session/value-objects/SessionParticipantStatus";
import { ParticipantAlreadyRespondedError } from "@domain/features/session/errors/ParticipantAlreadyRespondedError";

describe("SessionParticipant (entité)", () => {
  const buildInvited = (): SessionParticipant =>
    SessionParticipant.create({
      sessionId: "session-1",
      userId: "user-1",
      invitedAt: new Date("2026-06-24T10:00:00Z"),
    });

  it("create naît INVITED, sans date de réponse", () => {
    const participant = buildInvited();
    expect(participant.status).toBe(SessionParticipantStatus.INVITED);
    expect(participant.respondedAt).toBeNull();
  });

  it("accept passe INVITED → ACCEPTED en datant la réponse", () => {
    const respondedAt = new Date("2026-06-24T11:00:00Z");
    const accepted = buildInvited().accept({ respondedAt });

    expect(accepted.status).toBe(SessionParticipantStatus.ACCEPTED);
    expect(accepted.respondedAt?.getTime()).toBe(respondedAt.getTime());
  });

  it("accept ne mute pas l'instance d'origine (immuabilité)", () => {
    const invited = buildInvited();
    invited.accept({ respondedAt: new Date() });
    expect(invited.status).toBe(SessionParticipantStatus.INVITED);
  });

  it("refuse passe INVITED → REFUSED en datant la réponse", () => {
    const respondedAt = new Date("2026-06-24T11:30:00Z");
    const refused = buildInvited().refuse({ respondedAt });

    expect(refused.status).toBe(SessionParticipantStatus.REFUSED);
    expect(refused.respondedAt?.getTime()).toBe(respondedAt.getTime());
  });

  it("accept refuse une participation ayant déjà répondu", () => {
    const accepted = buildInvited().accept({ respondedAt: new Date() });
    expect(() => accepted.accept({ respondedAt: new Date() })).toThrow(
      ParticipantAlreadyRespondedError,
    );
  });

  it("refuse refuse une participation ayant déjà répondu", () => {
    const refused = buildInvited().refuse({ respondedAt: new Date() });
    expect(() => refused.refuse({ respondedAt: new Date() })).toThrow(
      ParticipantAlreadyRespondedError,
    );
  });

  it("restore reconstruit fidèlement une participation (round-trip)", () => {
    const snapshot = {
      sessionId: "session-9",
      userId: "user-9",
      status: SessionParticipantStatus.ACCEPTED,
      invitedAt: new Date("2026-06-01T10:00:00Z"),
      respondedAt: new Date("2026-06-01T12:00:00Z"),
    };

    const participant = SessionParticipant.restore(snapshot);

    expect(participant.sessionId).toBe("session-9");
    expect(participant.userId).toBe("user-9");
    expect(participant.status).toBe(SessionParticipantStatus.ACCEPTED);
  });
});
