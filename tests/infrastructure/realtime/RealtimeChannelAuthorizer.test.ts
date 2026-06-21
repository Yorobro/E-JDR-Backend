import { describe, it, expect } from "vitest";
import { RealtimeChannelAuthorizer } from "@infrastructure/realtime/WebSocketServer";
import { Result } from "@application/shared/Result";

const ok = () => Result.success<undefined, { message: string }>(undefined);
const ko = () => Result.failure<undefined, { message: string }>({ message: "non membre" });

describe("RealtimeChannelAuthorizer — sheet:", () => {
  it("autorise un membre du groupe de la fiche", async () => {
    const authorizer = new RealtimeChannelAuthorizer({
      groupAccess: { requireMember: async () => ok() },
      sheetGroupLookup: { groupIdOf: async () => "g-1" },
    });
    expect(await authorizer.canSubscribe("u-1", "sheet:s-1")).toBe(true);
  });

  it("refuse un non-membre du groupe de la fiche", async () => {
    const authorizer = new RealtimeChannelAuthorizer({
      groupAccess: { requireMember: async () => ko() },
      sheetGroupLookup: { groupIdOf: async () => "g-1" },
    });
    expect(await authorizer.canSubscribe("u-1", "sheet:s-1")).toBe(false);
  });

  it("refuse si la fiche n'existe pas (groupIdOf → null)", async () => {
    const authorizer = new RealtimeChannelAuthorizer({
      groupAccess: { requireMember: async () => ok() },
      sheetGroupLookup: { groupIdOf: async () => null },
    });
    expect(await authorizer.canSubscribe("u-1", "sheet:absent")).toBe(false);
  });
});
