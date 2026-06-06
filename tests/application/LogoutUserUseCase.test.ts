import { describe, it, expect, beforeEach } from "vitest";
import { LogoutUserUseCase } from "@application/auth/usecases/LogoutUserUseCase";
import { FakeRefreshTokenRepository, FakeTokenHasher } from "./fakes";

describe("LogoutUserUseCase", () => {
  let refreshTokenRepository: FakeRefreshTokenRepository;
  let useCase: LogoutUserUseCase;

  beforeEach(() => {
    refreshTokenRepository = new FakeRefreshTokenRepository();
    useCase = new LogoutUserUseCase(refreshTokenRepository, new FakeTokenHasher());
  });

  it("révoque le refresh token correspondant en base", async () => {
    // On stocke un token dont l'empreinte correspond au fake hasher ("thash:" + token).
    refreshTokenRepository.tokens.set("thash:my-refresh-token", {
      id: "rt-1",
      userId: "user-1",
      tokenHash: "thash:my-refresh-token",
      expiresAt: new Date("2999-01-01"),
    });

    const result = await useCase.execute({ refreshToken: "my-refresh-token" });

    expect(result.isSuccess).toBe(true);
    expect(refreshTokenRepository.tokens.has("thash:my-refresh-token")).toBe(false);
  });

  it("réussit même si le token est déjà absent (idempotence)", async () => {
    const result = await useCase.execute({ refreshToken: "inexistant" });

    expect(result.isSuccess).toBe(true);
  });
});
