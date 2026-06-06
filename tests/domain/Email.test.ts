import { describe, it, expect } from "vitest";
import { Email } from "@domain/auth/value-objects/Email";
import { InvalidEmailError } from "@domain/auth/errors/InvalidEmailError";

describe("Email (value object)", () => {
  it("accepte une adresse valide et la normalise (trim + minuscules)", () => {
    const email = Email.create("  John.DOE@Example.COM  ");
    expect(email.value).toBe("john.doe@example.com");
  });

  it("considère deux adresses équivalentes après normalisation comme égales", () => {
    const a = Email.create("user@test.com");
    const b = Email.create("USER@TEST.COM");
    expect(a.equals(b)).toBe(true);
  });

  it.each([
    "",
    "not-an-email",
    "missing@domain",
    "@no-local.com",
    "spaces in@email.com",
  ])("rejette une adresse invalide : %s", (invalid) => {
    expect(() => Email.create(invalid)).toThrow(InvalidEmailError);
  });
});
