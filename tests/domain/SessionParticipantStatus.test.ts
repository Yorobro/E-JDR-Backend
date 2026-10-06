import { describe, it, expect } from "vitest";
import { SessionParticipantStatus } from "@domain/features/session/value-objects/SessionParticipantStatus";
import { InvalidSessionParticipantStatusError } from "@domain/features/session/errors/InvalidSessionParticipantStatusError";

describe("SessionParticipantStatus", () => {
  it("create reconstruit chaque statut connu (round-trip)", () => {
    expect(SessionParticipantStatus.create("INVITED")).toBe(SessionParticipantStatus.INVITED);
    expect(SessionParticipantStatus.create("ACCEPTED")).toBe(SessionParticipantStatus.ACCEPTED);
    expect(SessionParticipantStatus.create("REFUSED")).toBe(SessionParticipantStatus.REFUSED);
  });

  it("les prédicats reflètent la valeur", () => {
    expect(SessionParticipantStatus.INVITED.isInvited()).toBe(true);
    expect(SessionParticipantStatus.ACCEPTED.isAccepted()).toBe(true);
    expect(SessionParticipantStatus.REFUSED.isRefused()).toBe(true);
    expect(SessionParticipantStatus.INVITED.isAccepted()).toBe(false);
  });

  it("rejette un statut inconnu", () => {
    expect(() => SessionParticipantStatus.create("MAYBE")).toThrow(
      InvalidSessionParticipantStatusError,
    );
  });
});
