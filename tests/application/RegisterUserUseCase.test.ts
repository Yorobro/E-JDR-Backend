import { describe, it, expect, beforeEach } from "vitest";
import { Email } from "@domain/auth/value-objects/Email";
import { RegisterUserUseCase } from "@application/auth/usecases/RegisterUserUseCase";
import { EmailAlreadyUsedError } from "@application/auth/errors/EmailAlreadyUsedError";
import {
  FakeUserRepository,
  FakePasswordHasher,
  FakeIdGenerator,
  FakeAuthTokenService,
  buildTestUser,
} from "./fakes";

describe("RegisterUserUseCase", () => {
  let userRepository: FakeUserRepository;
  let authTokenService: FakeAuthTokenService;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    userRepository = new FakeUserRepository();
    authTokenService = new FakeAuthTokenService();
    useCase = new RegisterUserUseCase(
      userRepository,
      new FakePasswordHasher(),
      new FakeIdGenerator(),
      authTokenService,
    );
  });

  it("inscrit un nouvel utilisateur, le persiste et le connecte directement", async () => {
    const result = await useCase.execute({
      email: "new@test.com",
      password: "password123",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.email).toBe("new@test.com");
    expect(result.value.tokens.accessToken).toContain("access-for-");
    // L'utilisateur a bien été persisté.
    expect(await userRepository.existsByEmail(Email.create("new@test.com"))).toBe(true);
    // La connexion directe a émis des jetons.
    expect(authTokenService.issuedFor).toHaveLength(1);
  });

  it("échoue avec EmailAlreadyUsedError si l'e-mail est déjà pris", async () => {
    userRepository.seed(buildTestUser("taken@test.com", "password123"));

    const result = await useCase.execute({
      email: "taken@test.com",
      password: "password123",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(EmailAlreadyUsedError);
    // Aucun jeton émis en cas d'échec.
    expect(authTokenService.issuedFor).toHaveLength(0);
  });
});
