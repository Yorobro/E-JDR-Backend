import { Email } from "@domain/auth/value-objects/Email";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ILogger } from "@application/shared/ILogger";
import { AccountLockedError } from "@application/auth/errors/AccountLockedError";
import { InvalidCredentialsError } from "@application/auth/errors/InvalidCredentialsError";
import { InvalidInputError } from "@application/auth/errors/InvalidInputError";
import { LoginUserCommand } from "@application/auth/commands/LoginUserCommand";
import {
  ILoginUserUseCase,
  LoginUserResult,
} from "@application/auth/abstractions/usecases/ILoginUserUseCase";
import { ICredentialRepository } from "@application/auth/abstractions/repositories/ICredentialRepository";
import { IPasswordHasher } from "@application/auth/abstractions/services/IPasswordHasher";
import { IAuthTokenService } from "@application/auth/abstractions/services/IAuthTokenService";

/**
 * Use case de connexion d'un utilisateur existant.
 *
 * Orchestration pure : retrouve l'identifiant d'authentification (`Credential`) par e-mail,
 * vérifie le mot de passe, puis délègue l'émission des jetons au service partagé. En cas
 * d'e-mail inconnu OU de mot de passe incorrect, renvoie une seule et même erreur métier
 * pour ne pas révéler quel champ est en cause (protection contre l'énumération).
 *
 * Implémente également la protection anti-brute-force : après 5 tentatives échouées,
 * le compte est verrouillé 15 minutes. Une connexion réussie réinitialise le compteur.
 */
export class LoginUserUseCase implements ILoginUserUseCase {
  constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly authTokenService: IAuthTokenService,
    private readonly logger: ILogger,
  ) {}

  public async execute(command: LoginUserCommand): Promise<Result<LoginUserResult, AppError>> {
    if (typeof command.password !== "string") {
      return Result.failure(new InvalidCredentialsError());
    }

    let email: Email;
    try {
      email = Email.create(command.email);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }
    const credential = await this.credentialRepository.findByEmail(email);

    if (credential === null) {
      return Result.failure(new InvalidCredentialsError());
    }

    const now = new Date();

    if (credential.isLocked(now)) {
      this.logger.warn("Connexion refusée — compte verrouillé", {
        email: email.value,
        lockedUntil: credential.lockedUntil,
      });
      return Result.failure(new AccountLockedError(credential.lockedUntil!));
    }

    const passwordMatches = await credential.verifyPassword(command.password, (plain, hash) =>
      this.passwordHasher.compare(plain, hash),
    );

    if (!passwordMatches) {
      const failed = credential.recordFailedAttempt(now);
      await this.credentialRepository.update(failed);
      this.logger.warn("Tentative de connexion échouée", {
        email: email.value,
        failedAttempts: failed.failedAttempts,
      });
      return Result.failure(new InvalidCredentialsError());
    }

    const updated = credential.resetFailedAttempts();
    await this.credentialRepository.update(updated);

    const tokens = await this.authTokenService.issueTokens(updated.userId, updated.email.value);

    this.logger.info("Connexion réussie", { userId: updated.userId });

    return Result.success({
      userId: updated.userId,
      email: updated.email.value,
      tokens,
    });
  }
}
