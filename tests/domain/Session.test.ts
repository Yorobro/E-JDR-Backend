import { describe, it, expect } from "vitest";
import { Session } from "@domain/features/session/entities/Session";
import { SessionTitle } from "@domain/features/session/value-objects/SessionTitle";
import { SessionStatus } from "@domain/features/session/value-objects/SessionStatus";
import { SessionNotLaunchableError } from "@domain/features/session/errors/SessionNotLaunchableError";
import { SessionNotStartableError } from "@domain/features/session/errors/SessionNotStartableError";

describe("Session (entité)", () => {
  const buildSession = (): Session =>
    Session.create({
      id: "session-1",
      campaignId: "campaign-1",
      title: SessionTitle.create("Première séance"),
      date: new Date("2026-07-01T20:00:00Z"),
      createdAt: new Date("2026-06-24T10:00:00Z"),
    });

  it("create naît au statut PLANNED, sans date de démarrage", () => {
    const session = buildSession();
    expect(session.status).toBe(SessionStatus.PLANNED);
    expect(session.startedAt).toBeNull();
  });

  it("expose le titre sous forme de value object SessionTitle", () => {
    const session = buildSession();
    expect(session.title).toBeInstanceOf(SessionTitle);
    expect(session.title.value).toBe("Première séance");
  });

  it("openLobby passe de PLANNED à LOBBY sans muter l'instance d'origine", () => {
    const session = buildSession();
    const inLobby = session.openLobby();

    expect(inLobby.status).toBe(SessionStatus.LOBBY);
    expect(inLobby.startedAt).toBeNull();
    // immuabilité : l'instance d'origine reste PLANNED
    expect(session.status).toBe(SessionStatus.PLANNED);
    expect(inLobby.id).toBe(session.id);
  });

  it("openLobby refuse une session qui n'est pas PLANNED", () => {
    const session = buildSession().openLobby();
    expect(() => session.openLobby()).toThrow(SessionNotLaunchableError);
  });

  it("start passe de LOBBY à ACTIVE et horodate le démarrage", () => {
    const startedAt = new Date("2026-07-01T20:05:00Z");
    const session = buildSession().openLobby().start({ startedAt });

    expect(session.status).toBe(SessionStatus.ACTIVE);
    expect(session.startedAt?.getTime()).toBe(startedAt.getTime());
  });

  it("start refuse une session encore PLANNED (lobby non ouvert)", () => {
    const session = buildSession();
    expect(() => session.start({ startedAt: new Date() })).toThrow(SessionNotStartableError);
  });

  it("withDetails préserve le statut et la date de démarrage", () => {
    const startedAt = new Date("2026-07-01T20:05:00Z");
    const active = buildSession().openLobby().start({ startedAt });

    const updated = active.withDetails({
      title: SessionTitle.create("Séance renommée"),
      date: new Date("2026-07-02T20:00:00Z"),
    });

    expect(updated.title.value).toBe("Séance renommée");
    expect(updated.status).toBe(SessionStatus.ACTIVE);
    expect(updated.startedAt?.getTime()).toBe(startedAt.getTime());
  });

  it("restore reconstruit fidèlement une session (round-trip)", () => {
    const snapshot = {
      id: "session-9",
      campaignId: "campaign-9",
      title: SessionTitle.create("Restaurée"),
      date: new Date("2026-08-03T18:00:00Z"),
      createdAt: new Date("2026-06-01T10:00:00Z"),
      status: SessionStatus.LOBBY,
      startedAt: null,
    };

    const session = Session.restore(snapshot);

    expect(session.id).toBe("session-9");
    expect(session.status).toBe(SessionStatus.LOBBY);
    expect(session.startedAt).toBeNull();
    expect(session.title.value).toBe("Restaurée");
  });
});
