import { describe, it, expect } from "vitest";
import { User } from "@domain/auth/entities/User";

describe("User (entité métier)", () => {
  it("expose son identité en lecture seule (id, createdAt)", () => {
    const createdAt = new Date("2025-01-01T00:00:00Z");
    const user = User.create({ id: "user-1", createdAt });

    expect(user.id).toBe("user-1");
    expect(user.createdAt).toEqual(createdAt);
  });

  it("se reconstruit à l'identique via restore", () => {
    const snapshot = { id: "user-9", createdAt: new Date("2024-06-01T12:00:00Z") };
    const user = User.restore(snapshot);

    expect(user.id).toBe("user-9");
    expect(user.createdAt).toEqual(snapshot.createdAt);
  });
});
