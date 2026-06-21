import { describe, it, expect } from "vitest";
import { RealtimeChannelAuthorizer } from "@infrastructure/realtime/WebSocketServer";
import { Result } from "@application/shared/Result";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";

/** Fake GroupAccessService : membre des groupes listés dans `memberOf`. */
function fakeGroupAccess(memberOf: Record<string, string[]>) {
  return {
    async requireMember(userId: string, groupId: string) {
      const ok = (memberOf[userId] ?? []).includes(groupId);
      return ok ? Result.success(undefined) : Result.failure(new NotGroupMemberError());
    },
  };
}

describe("RealtimeChannelAuthorizer", () => {
  it("autorise un user à s'abonner à SON propre canal user", async () => {
    const auth = new RealtimeChannelAuthorizer({
      groupAccess: fakeGroupAccess({}),
    });
    expect(await auth.canSubscribe("u1", "user:u1")).toBe(true);
  });

  it("refuse l'abonnement au canal user d'autrui", async () => {
    const auth = new RealtimeChannelAuthorizer({
      groupAccess: fakeGroupAccess({}),
    });
    expect(await auth.canSubscribe("u1", "user:u2")).toBe(false);
  });

  it("autorise le canal group si l'utilisateur est membre", async () => {
    const auth = new RealtimeChannelAuthorizer({
      groupAccess: fakeGroupAccess({ u1: ["g1"] }),
    });
    expect(await auth.canSubscribe("u1", "group:g1")).toBe(true);
    expect(await auth.canSubscribe("u1", "group:g2")).toBe(false);
  });

  it("refuse un canal malformé ou de type inconnu", async () => {
    const auth = new RealtimeChannelAuthorizer({
      groupAccess: fakeGroupAccess({}),
    });
    expect(await auth.canSubscribe("u1", "admin:1")).toBe(false);
    expect(await auth.canSubscribe("u1", "group:")).toBe(false);
  });

  it("refuse le canal sheet à ce stade (affiné au Lot 3)", async () => {
    const auth = new RealtimeChannelAuthorizer({
      groupAccess: fakeGroupAccess({}),
    });
    expect(await auth.canSubscribe("u1", "sheet:s1")).toBe(false);
  });
});
