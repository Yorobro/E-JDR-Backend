import { describe, it, expect } from "vitest";
import { Credential } from "@domain/auth/entities/Credential";
import { Email } from "@domain/auth/value-objects/Email";
import { HashedPassword } from "@domain/auth/value-objects/HashedPassword";

describe("Credential (entité d'authentification)", () => {
  const buildCredential = (): Credential =>
    Credential.create({
      id: "cred-1",
      userId: "user-1",
      email: Email.create("user@test.com"),
      password: HashedPassword.fromHash("hashed-value"),
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });

  it("expose ses propriétés en lecture seule via les value objects", () => {
    const credential = buildCredential();
    expect(credential.id).toBe("cred-1");
    expect(credential.userId).toBe("user-1");
    expect(credential.email.value).toBe("user@test.com");
    expect(credential.password.value).toBe("hashed-value");
  });

  it("verifyPassword délègue la comparaison et renvoie true en cas de correspondance", async () => {
    const credential = buildCredential();
    const compare = async (plain: string, hash: string): Promise<boolean> =>
      plain === "secret" && hash === "hashed-value";

    expect(await credential.verifyPassword("secret", compare)).toBe(true);
  });

  it("verifyPassword renvoie false quand la comparaison échoue", async () => {
    const credential = buildCredential();
    const compare = async (): Promise<boolean> => false;

    expect(await credential.verifyPassword("wrong", compare)).toBe(false);
  });
});
