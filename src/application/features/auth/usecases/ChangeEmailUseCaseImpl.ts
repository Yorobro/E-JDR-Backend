import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { tryCreateValueObject } from "@application/shared/tryCreateValueObject";
import { Email } from "@domain/features/auth/value-objects/Email";
import { ChangeEmailCommand } from "@application/features/auth/commands/ChangeEmailCommand";
import { ChangeEmailUseCase } from "@application/features/auth/abstractions/usecases/ChangeEmailUseCase";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import { EmailAlreadyUsedError } from "@application/features/auth/errors/EmailAlreadyUsedError";
import { UserNotFoundError } from "@application/features/auth/errors/UserNotFoundError";
import { UnitOfWork } from "@application/shared/UnitOfWork";

/**
 * Use case de changement d'e-mail du compte connecté.
 *
 * Orchestre la validation du nouvel e-mail, la vérification d'unicité, la mise à jour
 * de l'entité domaine et sa persistance dans une transaction.
 */
export class ChangeEmailUseCaseImpl implements ChangeEmailUseCase {
  constructor(
    private readonly credentialRepository: CredentialRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  public async execute(command: ChangeEmailCommand): Promise<Result<void, AppError>> {
    const newEmailResult = tryCreateValueObject(() => Email.create(command.newEmail));
    if (newEmailResult.isFailure) return Result.failure(newEmailResult.error);
    const newEmail = newEmailResult.value;

    const credential = await this.credentialRepository.findByUserId(command.userId);
    if (credential === null) return Result.failure(new UserNotFoundError());

    // Email inchangé → rien à faire (succès), pas de vérification d'unicité contre soi-même.
    if (!credential.email.equals(newEmail)) {
      if (await this.credentialRepository.existsByEmail(newEmail)) {
        return Result.failure(new EmailAlreadyUsedError());
      }
    }

    const updated = credential.withEmail(newEmail);
    await this.unitOfWork.execute(async (repos) => {
      await repos.credentials.updateEmail(updated);
    });

    return Result.success(undefined);
  }
}
