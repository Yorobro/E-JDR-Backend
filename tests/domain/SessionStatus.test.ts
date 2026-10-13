import { describe, it, expect } from "vitest";
import { SessionStatus } from "@domain/features/session/value-objects/SessionStatus";
import { InvalidSessionStatusError } from "@domain/features/session/errors/InvalidSessionStatusError";

describe("SessionStatus", () => {
  it("create reconstruit chaque statut connu (round-trip)", () => {
    expect(SessionStatus.create("PLANNED")).toBe(SessionStatus.PLANNED);
    expect(SessionStatus.create("LOBBY")).toBe(SessionStatus.LOBBY);
    expect(SessionStatus.create("ACTIVE")).toBe(SessionStatus.ACTIVE);
    expect(SessionStatus.create("ENDED")).toBe(SessionStatus.ENDED);
  });

  it("les prédicats reflètent la valeur", () => {
    expect(SessionStatus.PLANNED.isPlanned()).toBe(true);
    expect(SessionStatus.LOBBY.isLobby()).toBe(true);
    expect(SessionStatus.ACTIVE.isActive()).toBe(true);
    expect(SessionStatus.ENDED.isEnded()).toBe(true);
    expect(SessionStatus.PLANNED.isLobby()).toBe(false);
  });

  it("equals compare par valeur", () => {
    expect(SessionStatus.LOBBY.equals(SessionStatus.create("LOBBY"))).toBe(true);
    expect(SessionStatus.LOBBY.equals(SessionStatus.ACTIVE)).toBe(false);
  });

  it("rejette un statut inconnu", () => {
    expect(() => SessionStatus.create("PAUSED")).toThrow(InvalidSessionStatusError);
  });
});
