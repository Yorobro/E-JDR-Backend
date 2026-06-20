import { describe, it, expect, beforeEach } from "vitest";
import {
  FakeCredentialRepository,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCredential,
} from "./fakes";
import { ChangeEmailUseCaseImpl } from "@application/features/auth/usecases/ChangeEmailUseCaseImpl";

describe("ChangeEmailUseCase", () => {
  let credentialRepository: FakeCredentialRepository;
  let unitOfWork: FakeUnitOfWork;
  let useCase: ChangeEmailUseCaseImpl;

  beforeEach(() => {
    credentialRepository = new FakeCredentialRepository();
    const repos = buildFakeTransactionalRepositories({ credentials: credentialRepository });
    unitOfWork = new FakeUnitOfWork(repos);
    useCase = new ChangeEmailUseCaseImpl(credentialRepository, unitOfWork);
  });

  it("change l'email d'un credential existant et le persiste", async () => {
    const credential = buildTestCredential("ancien@exemple.fr", "password", "user-1");
    credentialRepository.seed(credential);

    const result = await useCase.execute({
      userId: "user-1",
      newEmail: "nouveau@exemple.fr",
    });

    expect(result.isSuccess).toBe(true);
    const updated = await credentialRepository.findByUserId("user-1");
    expect(updated?.email.value).toBe("nouveau@exemple.fr");
  });

  it("retourne INVALID_EMAIL pour un email malformé", async () => {
    const credential = buildTestCredential("ancien@exemple.fr", "password", "user-1");
    credentialRepository.seed(credential);

    const result = await useCase.execute({
      userId: "user-1",
      newEmail: "pasunmail",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("INVALID_EMAIL");
  });

  it("retourne EMAIL_ALREADY_USED si l'email est déjà pris par un autre compte", async () => {
    const credential1 = buildTestCredential("user1@exemple.fr", "password", "user-1", "cred-1");
    const credential2 = buildTestCredential("user2@exemple.fr", "password", "user-2", "cred-2");
    credentialRepository.seed(credential1);
    credentialRepository.seed(credential2);

    const result = await useCase.execute({
      userId: "user-1",
      newEmail: "user2@exemple.fr",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("EMAIL_ALREADY_USED");
  });

  it("réussit si le nouvel email est identique à l'email actuel (inchangé)", async () => {
    const credential = buildTestCredential("meme@exemple.fr", "password", "user-1");
    credentialRepository.seed(credential);

    const result = await useCase.execute({
      userId: "user-1",
      newEmail: "meme@exemple.fr",
    });

    expect(result.isSuccess).toBe(true);
  });

  it("retourne USER_NOT_FOUND si le credential est introuvable", async () => {
    const result = await useCase.execute({
      userId: "inexistant",
      newEmail: "nouveau@exemple.fr",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("USER_NOT_FOUND");
  });
});
