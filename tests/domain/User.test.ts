import { describe, it, expect } from "vitest";
import { User } from "@domain/auth/entities/User";
import { Email } from "@domain/auth/value-objects/Email";
import { HashedPassword } from "@domain/auth/value-objects/HashedPassword";

describe("User (entité)", () => {
  const buildUser = (): User =>
    User.create({
      id: "user-1",
      email: Email.create("user@test.com"),
      password: HashedPassword.fromHash("hashed-value"),
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });

  it("expose ses propriétés en lecture seule via les value objects", () => {
    const user = buildUser();
    expect(user.id).toBe("user-1");
    expect(user.email.value).toBe("user@test.com");
    expect(user.password.value).toBe("hashed-value");
  });

  it("verifyPassword délègue la comparaison et renvoie true en cas de correspondance", async () => {
    const user = buildUser();
    const compare = async (plain: string, hash: string): Promise<boolean> =>
      plain === "secret" && hash === "hashed-value";

    expect(await user.verifyPassword("secret", compare)).toBe(true);
  });

  it("verifyPassword renvoie false quand la comparaison échoue", async () => {
    const user = buildUser();
    const compare = async (): Promise<boolean> => false;

    expect(await user.verifyPassword("wrong", compare)).toBe(false);
  });
});
