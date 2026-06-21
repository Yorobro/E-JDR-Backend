import { describe, it, expect, beforeEach } from "vitest";
import { RefreshAccessTokenUseCaseImpl } from "@application/features/auth/usecases/RefreshAccessTokenUseCaseImpl";
import { InvalidRefreshTokenError } from "@application/features/auth/errors/InvalidRefreshTokenError";
import {
  FakeUserRepository,
  FakeRefreshTokenRepository,
  FakeTokenProvider,
  FakeTokenHasher,
  FakeAuthTokenService,
  buildFakeTransactionalRepositories,
  buildTestUser,
} from "./fakes";

describe("RefreshAccessTokenUseCaseImpl", () => {
  let userRepository: FakeUserRepository;
  let refreshTokenRepository: FakeRefreshTokenRepository;
  let tokenProvider: FakeTokenProvider;
  let authTokenService: FakeAuthTokenService;
  let useCase: RefreshAccessTokenUseCaseImpl;

  /** Construit un refresh token "valide" reconnu par le FakeTokenProvider. */
  const validRefreshToken = (): string =>
    `refresh:${JSON.stringify({ userId: "user-1", email: "user@test.com" })}`;

  beforeEach(() => {
    const txRepos = buildFakeTransactionalRepositories();
    userRepository = txRepos.users;
    refreshTokenRepository = txRepos.refreshTokens;
    tokenProvider = new FakeTokenProvider();
    authTokenService = new FakeAuthTokenService();
    useCase = new RefreshAccessTokenUseCaseImpl(
      userRepository,
      refreshTokenRepository,
      tokenProvider,
      new FakeTokenHasher(),
      authTokenService,
    );
  });

  it("émet un nouvel access token sans révoquer le refresh token (pas de rotation)", async () => {
    userRepository.seed(buildTestUser("user-1"));
    const token = validRefreshToken();
    refreshTokenRepository.tokens.set(`thash:${token}`, {
      id: "rt-1",
      userId: "user-1",
      tokenHash: `thash:${token}`,
      expiresAt: new Date("2999-01-01"),
    });

    const result = await useCase.execute({ refreshToken: token });

    expect(result.isSuccess).toBe(true);
    expect(authTokenService.accessIssuedFor).toEqual(["user-1"]);
    // Le refresh token N'EST PAS révoqué : la session de cet appareil reste valide,
    // ce qui permet à plusieurs appareils de coexister sans se déconnecter mutuellement.
    expect(refreshTokenRepository.tokens.has(`thash:${token}`)).toBe(true);
    // Aucun nouveau refresh token n'est émis (pas de rotation) : un seul reste en base.
    expect(refreshTokenRepository.tokens.size).toBe(1);
  });

  it("conserve les sessions indépendantes de deux appareils lors d'un refresh", async () => {
    userRepository.seed(buildTestUser("user-1"));
    const tokenA = validRefreshToken();
    // Second appareil : même utilisateur, refresh token distinct (autre session en base).
    const tokenB = `refresh:${JSON.stringify({ userId: "user-1", email: "user@test.com", jti: "b" })}`;
    refreshTokenRepository.tokens.set(`thash:${tokenA}`, {
      id: "rt-a",
      userId: "user-1",
      tokenHash: `thash:${tokenA}`,
      expiresAt: new Date("2999-01-01"),
    });
    refreshTokenRepository.tokens.set(`thash:${tokenB}`, {
      id: "rt-b",
      userId: "user-1",
      tokenHash: `thash:${tokenB}`,
      expiresAt: new Date("2999-01-01"),
    });

    // L'appareil A rafraîchit sa session.
    const result = await useCase.execute({ refreshToken: tokenA });

    expect(result.isSuccess).toBe(true);
    // Les deux sessions survivent : l'appareil B n'est pas déconnecté par le refresh de A.
    expect(refreshTokenRepository.tokens.has(`thash:${tokenA}`)).toBe(true);
    expect(refreshTokenRepository.tokens.has(`thash:${tokenB}`)).toBe(true);
  });

  it("refuse un refresh token présent en base mais expiré (défense en profondeur)", async () => {
    userRepository.seed(buildTestUser("user-1"));
    const token = validRefreshToken();
    // Token présent en base mais déjà expiré : il ne doit pas permettre de rafraîchir,
    // même si sa signature était (hypothétiquement) encore acceptée.
    refreshTokenRepository.tokens.set(`thash:${token}`, {
      id: "rt-1",
      userId: "user-1",
      tokenHash: `thash:${token}`,
      expiresAt: new Date("2000-01-01"),
    });

    const result = await useCase.execute({ refreshToken: token });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidRefreshTokenError);
    expect(authTokenService.accessIssuedFor).toHaveLength(0);
  });

  it("échoue si la signature du refresh token est invalide", async () => {
    tokenProvider.refreshTokenValid = false;

    const result = await useCase.execute({ refreshToken: "n-importe-quoi" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidRefreshTokenError);
  });

  it("échoue si le token est valide mais absent de la base (révoqué)", async () => {
    userRepository.seed(buildTestUser("user-1"));

    const result = await useCase.execute({ refreshToken: validRefreshToken() });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidRefreshTokenError);
    expect(authTokenService.accessIssuedFor).toHaveLength(0);
  });

  it("échoue si l'utilisateur n'existe plus (token valide, user introuvable)", async () => {
    // Token présent en base mais aucun utilisateur correspondant à payload.userId.
    const token = validRefreshToken();
    refreshTokenRepository.tokens.set(`thash:${token}`, {
      id: "rt-1",
      userId: "user-1",
      tokenHash: `thash:${token}`,
      expiresAt: new Date("2999-01-01"),
    });

    const result = await useCase.execute({ refreshToken: token });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidRefreshTokenError);
  });

  it("purge les refresh tokens expirés lors d'un rafraîchissement réussi", async () => {
    userRepository.seed(buildTestUser("user-1"));
    const token = validRefreshToken();
    refreshTokenRepository.tokens.set(`thash:${token}`, {
      id: "rt-1",
      userId: "user-1",
      tokenHash: `thash:${token}`,
      expiresAt: new Date("2999-01-01"),
    });
    // Un token déjà expiré qui doit être purgé en passant.
    refreshTokenRepository.tokens.set("thash:expired", {
      id: "rt-expired",
      userId: "user-1",
      tokenHash: "thash:expired",
      expiresAt: new Date("2000-01-01"),
    });

    const result = await useCase.execute({ refreshToken: token });

    expect(result.isSuccess).toBe(true);
    expect(refreshTokenRepository.tokens.has("thash:expired")).toBe(false);
  });
});
