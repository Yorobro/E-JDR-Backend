import { describe, it, expect } from "vitest";

import { GetCurrentUserUseCase } from "@application/features/auth/usecases/GetCurrentUserUseCase";
import { UserNotFoundError } from "@application/features/auth/errors/UserNotFoundError";

import {
  FakeUserRepository,
  FakeCredentialRepository,
  buildTestUser,
  buildTestCredential,
} from "./fakes";

describe("GetCurrentUserUseCase", () => {
  function buildUseCase() {
    const users = new FakeUserRepository();
    const credentials = new FakeCredentialRepository();
    return { useCase: new GetCurrentUserUseCase(users, credentials), users, credentials };
  }

  it("renvoie le profil quand l'utilisateur et son credential existent", async () => {
    const { useCase, users, credentials } = buildUseCase();
    users.seed(buildTestUser("user-1"));
    credentials.seed(buildTestCredential("me@test.com", "password123", "user-1"));

    const result = await useCase.execute({ userId: "user-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({
      userId: "user-1",
      email: "me@test.com",
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
  });

  it("échoue avec UserNotFoundError quand l'utilisateur n'existe pas", async () => {
    const { useCase } = buildUseCase();

    const result = await useCase.execute({ userId: "ghost" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(UserNotFoundError);
    expect(result.error.code).toBe("USER_NOT_FOUND");
  });

  it("échoue avec UserNotFoundError quand le credential n'existe pas", async () => {
    const { useCase, users } = buildUseCase();
    users.seed(buildTestUser("user-1"));

    const result = await useCase.execute({ userId: "user-1" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(UserNotFoundError);
  });
});
