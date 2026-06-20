import { describe, it, expect, beforeEach } from "vitest";
import {
  FakeCredentialRepository,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCredential,
} from "./fakes";
import { ChangePasswordUseCaseImpl } from "@application/features/auth/usecases/ChangePasswordUseCaseImpl";
import { PasswordHasherService } from "@application/features/auth/abstractions/services/PasswordHasherService";

/** Fake du PasswordHasherService : comportement contrôlable par test. */
class FakeControllablePasswordHasher implements PasswordHasherService {
  /** Si `true`, `compare` renvoie `true` (bon mot de passe actuel). */
  public compareResult = true;

  public async hash(plainPassword: string): Promise<string> {
    return `newhashed:${plainPassword}`;
  }

  public async compare(_plain: string, _hash: string): Promise<boolean> {
    return this.compareResult;
  }
}

describe("ChangePasswordUseCase", () => {
  let credentialRepository: FakeCredentialRepository;
  let unitOfWork: FakeUnitOfWork;
  let passwordHasher: FakeControllablePasswordHasher;
  let useCase: ChangePasswordUseCaseImpl;

  beforeEach(() => {
    credentialRepository = new FakeCredentialRepository();
    const repos = buildFakeTransactionalRepositories({ credentials: credentialRepository });
    unitOfWork = new FakeUnitOfWork(repos);
    passwordHasher = new FakeControllablePasswordHasher();
    useCase = new ChangePasswordUseCaseImpl(credentialRepository, passwordHasher, unitOfWork);
  });

  it("change le mot de passe d'un credential existant et persiste le nouveau hash", async () => {
    const credential = buildTestCredential("user@exemple.fr", "AncienMdp1!", "user-1");
    credentialRepository.seed(credential);
    passwordHasher.compareResult = true;

    const result = await useCase.execute({
      userId: "user-1",
      currentPassword: "AncienMdp1!",
      newPassword: "NouveauMdp2@",
    });

    expect(result.isSuccess).toBe(true);
    const updated = await credentialRepository.findByUserId("user-1");
    expect(updated?.password.value).toBe("newhashed:NouveauMdp2@");
  });

  it("retourne INVALID_CREDENTIALS si le mot de passe actuel est incorrect", async () => {
    const credential = buildTestCredential("user@exemple.fr", "AncienMdp1!", "user-1");
    credentialRepository.seed(credential);
    passwordHasher.compareResult = false;

    const result = await useCase.execute({
      userId: "user-1",
      currentPassword: "MauvaisMdp",
      newPassword: "NouveauMdp2@",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("retourne WEAK_PASSWORD si le nouveau mot de passe est trop faible", async () => {
    const credential = buildTestCredential("user@exemple.fr", "AncienMdp1!", "user-1");
    credentialRepository.seed(credential);
    passwordHasher.compareResult = true;

    const result = await useCase.execute({
      userId: "user-1",
      currentPassword: "AncienMdp1!",
      newPassword: "abc",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("WEAK_PASSWORD");
  });

  it("retourne USER_NOT_FOUND si le credential est introuvable", async () => {
    const result = await useCase.execute({
      userId: "inexistant",
      currentPassword: "AncienMdp1!",
      newPassword: "NouveauMdp2@",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("USER_NOT_FOUND");
  });
});
