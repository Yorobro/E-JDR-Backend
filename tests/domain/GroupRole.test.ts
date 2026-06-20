import { describe, it, expect } from "vitest";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";

describe("GroupRole", () => {
  it("accepte MJ", () => {
    expect(GroupRole.create("MJ").value).toBe("MJ");
  });
  it("isEditor vrai pour ADMIN et MJ, faux pour MEMBER", () => {
    expect(GroupRole.ADMIN.isEditor()).toBe(true);
    expect(GroupRole.MJ.isEditor()).toBe(true);
    expect(GroupRole.MEMBER.isEditor()).toBe(false);
  });
  it("rejette un rôle inconnu", () => {
    expect(() => GroupRole.create("BOSS")).toThrow();
  });
});
