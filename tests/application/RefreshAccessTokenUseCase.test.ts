import { describe, it, expect, beforeEach } from "vitest";
import { RefreshAccessTokenUseCase } from "@application/auth/usecases/RefreshAccessTokenUseCase";
import { InvalidRefreshTokenError } from "@application/auth/errors/InvalidRefreshTokenError";
import {
  FakeUserRepository,
  FakeRefreshTokenRepository,
  FakeTokenProvider,
  FakeTokenHasher,
  FakeAuthTokenService,
  buildTestUser,
} from "./fakes";

describe("RefreshAccessTokenUseCase", () => {
  let userRepository: FakeUserRepository;
  let refreshTokenRepository: FakeRefreshTokenRepository;
  let tokenProvider: FakeTokenProvider;
  let authTokenService: FakeAuthTokenService;
  let useCase: RefreshAccessTokenUseCase;

  /** Construit un refresh token "valide" reconnu par le FakeTokenProvider. */
  const validRefreshToken = (): string =>
    `refresh:${JSON.stringify({ userId: "user-1", email: "user@test.com" })}`;

  beforeEach(() => {
    userRepository = new FakeUserRepository();
    refreshTokenRepository = new FakeRefreshTokenRepository();
    tokenProvider = new FakeTokenProvider();
    authTokenService = new FakeAuthTokenService();
    useCase = new RefreshAccessTokenUseCase(
      userRepository,
      refreshTokenRepository,
      tokenProvider,
      new FakeTokenHasher(),
      authTokenService,
    );
  });

  it("émet une nouvelle paire de jetons et révoque l'ancien (rotation)", async () => {
    userRepository.seed(buildTestUser("user@test.com", "password123"));
    const token = validRefreshToken();
    refreshTokenRepository.tokens.set(`thash:${token}`, {
      id: "rt-1",
      userId: "user-1",
      tokenHash: `thash:${token}`,
      expiresAt: new Date("2999-01-01"),
    });

    const result = await useCase.execute({ refreshToken: token });

    expect(result.isSuccess).toBe(true);
    expect(authTokenService.issuedFor).toEqual(["user-1"]);
    // L'ancien token a été révoqué (rotation).
    expect(refreshTokenRepository.tokens.has(`thash:${token}`)).toBe(false);
  });

  it("échoue si la signature du refresh token est invalide", async () => {
    tokenProvider.refreshTokenValid = false;

    const result = await useCase.execute({ refreshToken: "n-importe-quoi" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidRefreshTokenError);
  });

  it("échoue si le token est valide mais absent de la base (révoqué)", async () => {
    userRepository.seed(buildTestUser("user@test.com", "password123"));

    const result = await useCase.execute({ refreshToken: validRefreshToken() });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidRefreshTokenError);
    expect(authTokenService.issuedFor).toHaveLength(0);
  });
});
