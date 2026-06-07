import { Email } from "@domain/auth/value-objects/Email";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { InvalidCredentialsError } from "@application/auth/errors/InvalidCredentialsError";
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
 */
export class LoginUserUseCase implements ILoginUserUseCase {
  /**
   * @param credentialRepository - Port de persistance des identifiants d'authentification.
   * @param passwordHasher - Port de comparaison du mot de passe.
   * @param authTokenService - Service partagé d'émission des jetons.
   */
  constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly authTokenService: IAuthTokenService,
  ) {}

  /**
   * @inheritdoc
   */
  public async execute(command: LoginUserCommand): Promise<Result<LoginUserResult, AppError>> {
    // Un mot de passe absent ou non textuel (corps de requête partiel) est traité comme
    // des identifiants invalides : on ne révèle pas quel champ pose problème, et on évite
    // de transmettre une valeur non-string au comparateur bcrypt.
    if (typeof command.password !== "string") {
      return Result.failure(new InvalidCredentialsError());
    }

    const email = Email.create(command.email);
    const credential = await this.credentialRepository.findByEmail(email);

    if (credential === null) {
      return Result.failure(new InvalidCredentialsError());
    }

    const passwordMatches = await credential.verifyPassword(command.password, (plain, hash) =>
      this.passwordHasher.compare(plain, hash),
    );

    if (!passwordMatches) {
      return Result.failure(new InvalidCredentialsError());
    }

    const tokens = await this.authTokenService.issueTokens(
      credential.userId,
      credential.email.value,
    );

    return Result.success({
      userId: credential.userId,
      email: credential.email.value,
      tokens,
    });
  }
}
