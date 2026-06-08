import { describe, it, expect, beforeEach } from "vitest";
import { Email } from "@domain/auth/value-objects/Email";
import { RegisterUserUseCase } from "@application/auth/usecases/RegisterUserUseCase";
import { EmailAlreadyUsedError } from "@application/auth/errors/EmailAlreadyUsedError";
import {
  FakeUserRepository,
  FakeCredentialRepository,
  FakeLogger,
  FakePasswordHasher,
  FakeIdGenerator,
  FakeAuthTokenService,
  buildTestCredential,
} from "./fakes";

describe("RegisterUserUseCase", () => {
  let userRepository: FakeUserRepository;
  let credentialRepository: FakeCredentialRepository;
  let authTokenService: FakeAuthTokenService;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    userRepository = new FakeUserRepository();
    credentialRepository = new FakeCredentialRepository();
    authTokenService = new FakeAuthTokenService();
    useCase = new RegisterUserUseCase(
      userRepository,
      credentialRepository,
      new FakePasswordHasher(),
      new FakeIdGenerator(),
      authTokenService,
      new FakeLogger(),
    );
  });

  it("inscrit un nouvel utilisateur, crée l'identité métier ET l'identifiant, et connecte", async () => {
    const result = await useCase.execute({
      email: "new@test.com",
      password: "password123",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.email).toBe("new@test.com");
    expect(result.value.tokens.accessToken).toContain("access-for-");
    // L'identifiant d'authentification a bien été persisté.
    expect(await credentialRepository.existsByEmail(Email.create("new@test.com"))).toBe(true);
    // L'utilisateur métier a bien été persisté (récupérable par son id).
    expect(await userRepository.findById(result.value.userId)).not.toBeNull();
    // La connexion directe a émis des jetons.
    expect(authTokenService.issuedFor).toHaveLength(1);
  });

  it("échoue avec EmailAlreadyUsedError si l'e-mail est déjà pris", async () => {
    credentialRepository.seed(buildTestCredential("taken@test.com", "password123"));

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
