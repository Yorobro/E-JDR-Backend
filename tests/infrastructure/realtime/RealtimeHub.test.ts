import { describe, it, expect, beforeEach } from "vitest";
import { RealtimeHub, RealtimeClient } from "@infrastructure/realtime/RealtimeHub";

class FakeClient implements RealtimeClient {
  public readonly sent: string[] = [];
  public send(data: string): void {
    this.sent.push(data);
  }
}

describe("RealtimeHub", () => {
  let hub: RealtimeHub;
  beforeEach(() => {
    hub = new RealtimeHub();
  });

  it("diffuse un message à tous les clients abonnés au canal", () => {
    const a = new FakeClient();
    const b = new FakeClient();
    hub.subscribe(a, "group:1");
    hub.subscribe(b, "group:1");

    hub.publish("group:1", { type: "invalidate", channel: "group:1" });

    const expected = JSON.stringify({ type: "invalidate", channel: "group:1" });
    expect(a.sent).toEqual([expected]);
    expect(b.sent).toEqual([expected]);
  });

  it("n'envoie rien aux clients non abonnés au canal", () => {
    const a = new FakeClient();
    hub.subscribe(a, "group:1");

    hub.publish("group:2", { x: 1 });

    expect(a.sent).toEqual([]);
  });

  it("ne dédouble pas un client abonné deux fois au même canal", () => {
    const a = new FakeClient();
    hub.subscribe(a, "group:1");
    hub.subscribe(a, "group:1");

    hub.publish("group:1", { x: 1 });

    expect(a.sent).toHaveLength(1);
  });

  it("cesse de diffuser après désabonnement", () => {
    const a = new FakeClient();
    hub.subscribe(a, "group:1");
    hub.unsubscribe(a, "group:1");

    hub.publish("group:1", { x: 1 });

    expect(a.sent).toEqual([]);
    expect(hub.subscriberCount("group:1")).toBe(0);
  });

  it("removeClient retire le client de tous ses canaux", () => {
    const a = new FakeClient();
    hub.subscribe(a, "group:1");
    hub.subscribe(a, "user:7");

    hub.removeClient(a);

    expect(hub.subscriberCount("group:1")).toBe(0);
    expect(hub.subscriberCount("user:7")).toBe(0);
  });
});
