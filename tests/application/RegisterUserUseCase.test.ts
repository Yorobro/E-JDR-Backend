import { describe, it, expect, beforeEach } from "vitest";
import { Email } from "@domain/features/auth/value-objects/Email";
import { RegisterUserUseCaseImpl } from "@application/features/auth/usecases/RegisterUserUseCaseImpl";
import { EmailAlreadyUsedError } from "@application/features/auth/errors/EmailAlreadyUsedError";
import {
  FakeLogger,
  FakePasswordHasher,
  FakeIdGenerator,
  FakeAuthTokenService,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCredential,
} from "./fakes";

describe("RegisterUserUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let authTokenService: FakeAuthTokenService;
  let useCase: RegisterUserUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const credentialRepository = txRepos.credentials; // partagé lecture + écriture
    const unitOfWork = new FakeUnitOfWork(txRepos);
    authTokenService = new FakeAuthTokenService();
    useCase = new RegisterUserUseCaseImpl(
      credentialRepository,
      new FakePasswordHasher(),
      new FakeIdGenerator(),
      authTokenService,
      unitOfWork,
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
    expect(await txRepos.credentials.existsByEmail(Email.create("new@test.com"))).toBe(true);
    // L'utilisateur métier a bien été persisté (récupérable par son id).
    expect(await txRepos.users.findById(result.value.userId)).not.toBeNull();
    // La connexion directe a émis des jetons.
    expect(authTokenService.issuedFor).toHaveLength(1);
  });

  it("échoue avec EmailAlreadyUsedError si l'e-mail est déjà pris", async () => {
    txRepos.credentials.seed(buildTestCredential("taken@test.com", "password123"));

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
