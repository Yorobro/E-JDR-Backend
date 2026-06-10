import { describe, it, expect, beforeEach } from "vitest";
import { LogoutUserUseCaseImpl } from "@application/features/auth/usecases/LogoutUserUseCaseImpl";
import { FakeTokenHasher, FakeUnitOfWork, buildFakeTransactionalRepositories } from "./fakes";

describe("LogoutUserUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: LogoutUserUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const unitOfWork = new FakeUnitOfWork(txRepos);
    useCase = new LogoutUserUseCaseImpl(new FakeTokenHasher(), unitOfWork);
  });

  it("révoque le refresh token correspondant en base", async () => {
    // On stocke un token dont l'empreinte correspond au fake hasher ("thash:" + token).
    txRepos.refreshTokens.tokens.set("thash:my-refresh-token", {
      id: "rt-1",
      userId: "user-1",
      tokenHash: "thash:my-refresh-token",
      expiresAt: new Date("2999-01-01"),
    });

    const result = await useCase.execute({ refreshToken: "my-refresh-token" });

    expect(result.isSuccess).toBe(true);
    expect(txRepos.refreshTokens.tokens.has("thash:my-refresh-token")).toBe(false);
  });

  it("réussit même si le token est déjà absent (idempotence)", async () => {
    const result = await useCase.execute({ refreshToken: "inexistant" });

    expect(result.isSuccess).toBe(true);
  });
});
