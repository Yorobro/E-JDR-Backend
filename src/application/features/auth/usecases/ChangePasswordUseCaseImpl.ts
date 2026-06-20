import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { tryCreateValueObject } from "@application/shared/tryCreateValueObject";
import { PlainPassword } from "@domain/features/auth/value-objects/PlainPassword";
import { HashedPassword } from "@domain/features/auth/value-objects/HashedPassword";
import { ChangePasswordCommand } from "@application/features/auth/commands/ChangePasswordCommand";
import { ChangePasswordUseCase } from "@application/features/auth/abstractions/usecases/ChangePasswordUseCase";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import { PasswordHasherService } from "@application/features/auth/abstractions/services/PasswordHasherService";
import { InvalidCredentialsError } from "@application/features/auth/errors/InvalidCredentialsError";
import { UserNotFoundError } from "@application/features/auth/errors/UserNotFoundError";
import { UnitOfWork } from "@application/shared/UnitOfWork";

/**
 * Use case de changement de mot de passe du compte connecté.
 *
 * Orchestre la vérification du mot de passe actuel, la validation de robustesse du nouveau,
 * le re-hachage, la mise à jour de l'entité domaine et sa persistance dans une transaction.
 */
export class ChangePasswordUseCaseImpl implements ChangePasswordUseCase {
  constructor(
    private readonly credentialRepository: CredentialRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  public async execute(command: ChangePasswordCommand): Promise<Result<void, AppError>> {
    const credential = await this.credentialRepository.findByUserId(command.userId);
    if (credential === null) return Result.failure(new UserNotFoundError());

    const matches = await credential.verifyPassword(command.currentPassword, (p, h) =>
      this.passwordHasher.compare(p, h),
    );
    if (!matches) return Result.failure(new InvalidCredentialsError());

    const newPlainResult = tryCreateValueObject(() => PlainPassword.create(command.newPassword));
    if (newPlainResult.isFailure) return Result.failure(newPlainResult.error);

    const hash = await this.passwordHasher.hash(newPlainResult.value.value);
    const updated = credential.withPassword(HashedPassword.fromHash(hash));
    await this.unitOfWork.execute(async (repos) => {
      await repos.credentials.updatePassword(updated);
    });

    return Result.success(undefined);
  }
}
