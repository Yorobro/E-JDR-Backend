import { describe, it, expect } from "vitest";
import { FakeUnitOfWork, buildFakeTransactionalRepositories, buildTestUser } from "./fakes";

describe("FakeUnitOfWork", () => {
  it("exécute le callback avec les repos fournis et retourne sa valeur", async () => {
    const repos = buildFakeTransactionalRepositories();
    const uow = new FakeUnitOfWork(repos);

    const user = buildTestUser("u-1");
    const result = await uow.execute(async (r) => {
      await r.users.save(user);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(await repos.users.findById("u-1")).not.toBeNull();
  });

  it("propage l'erreur si le callback lève", async () => {
    const repos = buildFakeTransactionalRepositories();
    const uow = new FakeUnitOfWork(repos);

    await expect(
      uow.execute(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
