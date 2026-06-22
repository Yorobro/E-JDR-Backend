import { describe, it, expect } from "vitest";
import {
  userChannel,
  groupChannel,
  sheetChannel,
  parseChannel,
} from "@infrastructure/realtime/RealtimeChannels";

describe("RealtimeChannels", () => {
  it("construit les noms de canaux préfixés par type", () => {
    expect(userChannel("u1")).toBe("user:u1");
    expect(groupChannel("g1")).toBe("group:g1");
    expect(sheetChannel("s1")).toBe("sheet:s1");
  });

  it("parse un canal valide en {kind, id}", () => {
    expect(parseChannel("group:42")).toEqual({ kind: "group", id: "42" });
    expect(parseChannel("user:abc")).toEqual({ kind: "user", id: "abc" });
    expect(parseChannel("sheet:99")).toEqual({ kind: "sheet", id: "99" });
  });

  it("renvoie null pour un canal de type inconnu ou malformé", () => {
    expect(parseChannel("admin:1")).toBeNull();
    expect(parseChannel("group:")).toBeNull();
    expect(parseChannel("nope")).toBeNull();
  });
});
