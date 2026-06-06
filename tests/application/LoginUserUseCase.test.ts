import { describe, it, expect, beforeEach } from "vitest";
import { LoginUserUseCase } from "@application/auth/usecases/LoginUserUseCase";
import { InvalidCredentialsError } from "@application/auth/errors/InvalidCredentialsError";
import {
  FakeUserRepository,
  FakePasswordHasher,
  FakeAuthTokenService,
  buildTestUser,
} from "./fakes";

describe("LoginUserUseCase", () => {
  let userRepository: FakeUserRepository;
  let authTokenService: FakeAuthTokenService;
  let useCase: LoginUserUseCase;

  beforeEach(() => {
    userRepository = new FakeUserRepository();
    authTokenService = new FakeAuthTokenService();
    useCase = new LoginUserUseCase(userRepository, new FakePasswordHasher(), authTokenService);
  });

  it("connecte un utilisateur avec des identifiants valides et émet des jetons", async () => {
    userRepository.seed(buildTestUser("user@test.com", "password123"));

    const result = await useCase.execute({ email: "user@test.com", password: "password123" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.email).toBe("user@test.com");
    expect(authTokenService.issuedFor).toHaveLength(1);
  });

  it("échoue (InvalidCredentialsError) si le mot de passe est incorrect", async () => {
    userRepository.seed(buildTestUser("user@test.com", "password123"));

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
