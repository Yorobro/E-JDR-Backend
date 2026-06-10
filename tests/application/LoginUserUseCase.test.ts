import { describe, it, expect, beforeEach } from "vitest";
import { LoginUserUseCase } from "@application/features/auth/usecases/LoginUserUseCase";
import { InvalidCredentialsError } from "@application/features/auth/errors/InvalidCredentialsError";
import {
  FakeCredentialRepository,
  FakeLogger,
  FakePasswordHasher,
  FakeAuthTokenService,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCredential,
} from "./fakes";

describe("LoginUserUseCase", () => {
  let credentialRepository: FakeCredentialRepository;
  let authTokenService: FakeAuthTokenService;
  let useCase: LoginUserUseCase;

  beforeEach(() => {
    const txRepos = buildFakeTransactionalRepositories();
    credentialRepository = txRepos.credentials; // partagé lecture + écriture
    const unitOfWork = new FakeUnitOfWork(txRepos);
    authTokenService = new FakeAuthTokenService();
    useCase = new LoginUserUseCase(
      credentialRepository,
      new FakePasswordHasher(),
      authTokenService,
      unitOfWork,
      new FakeLogger(),
    );
  });

  it("connecte un utilisateur avec des identifiants valides et émet des jetons", async () => {
    credentialRepository.seed(buildTestCredential("user@test.com", "password123", "user-42"));

    const result = await useCase.execute({ email: "user@test.com", password: "password123" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.email).toBe("user@test.com");
    expect(result.value.userId).toBe("user-42");
    expect(authTokenService.issuedFor).toEqual(["user-42"]);
  });

  it("échoue (InvalidCredentialsError) si le mot de passe est incorrect", async () => {
    credentialRepository.seed(buildTestCredential("user@test.com", "password123"));

    const result = await useCase.execute({ email: "user@test.com", password: "wrong-password" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidCredentialsError);
    expect(authTokenService.issuedFor).toHaveLength(0);
  });

  it("échoue (InvalidCredentialsError) si l'utilisateur n'existe pas", async () => {
    const result = await useCase.execute({ email: "unknown@test.com", password: "password123" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidCredentialsError);
  });
});
