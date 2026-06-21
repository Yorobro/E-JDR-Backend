import { describe, it, expect, beforeEach } from "vitest";
import { RealtimeHub, RealtimeClient } from "@infrastructure/realtime/RealtimeHub";
import { WsRealtimeNotifier } from "@infrastructure/realtime/WsRealtimeNotifier";
import { FakeLogger } from "../../application/serviceFakes";

class FakeClient implements RealtimeClient {
  public readonly sent: string[] = [];
  public send(data: string): void {
    this.sent.push(data);
  }
}

describe("WsRealtimeNotifier", () => {
  let hub: RealtimeHub;
  let notifier: WsRealtimeNotifier;
  beforeEach(() => {
    hub = new RealtimeHub();
    notifier = new WsRealtimeNotifier(hub, new FakeLogger());
  });

  it("publie un event d'invalidation sur le canal user", () => {
    const client = new FakeClient();
    hub.subscribe(client, "user:u1");

    notifier.notifyUserChanged("u1", "character-sheets");

    expect(JSON.parse(client.sent[0])).toEqual({
      type: "invalidate",
      channel: "user:u1",
      resource: "character-sheets",
      scopeId: "u1",
    });
  });

  it("publie sur le canal group", () => {
    const client = new FakeClient();
    hub.subscribe(client, "group:g1");

    notifier.notifyGroupChanged("g1", "campaigns");

    expect(JSON.parse(client.sent[0])).toEqual({
      type: "invalidate",
      channel: "group:g1",
      resource: "campaigns",
      scopeId: "g1",
    });
  });

  it("publie sur le canal sheet", () => {
    const client = new FakeClient();
    hub.subscribe(client, "sheet:s1");

    notifier.notifySheetChanged("s1", "character-sheet");

    expect(JSON.parse(client.sent[0]).channel).toBe("sheet:s1");
  });

  it("best-effort : une erreur de publication ne se propage pas", () => {
    const throwingHub = {
      publish() {
        throw new Error("boom");
      },
    } as unknown as RealtimeHub;
    const safeNotifier = new WsRealtimeNotifier(throwingHub, new FakeLogger());

    expect(() => safeNotifier.notifyUserChanged("u1", "x")).not.toThrow();
  });
});
