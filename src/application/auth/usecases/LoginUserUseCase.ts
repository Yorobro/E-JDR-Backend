import { Email } from "@domain/auth/value-objects/Email";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { InvalidCredentialsError } from "@application/auth/errors/InvalidCredentialsError";
import { LoginUserCommand } from "@application/auth/commands/LoginUserCommand";
import {
  ILoginUserUseCase,
  LoginUserResult,
} from "@application/auth/abstractions/usecases/ILoginUserUseCase";
import { IUserRepository } from "@application/auth/abstractions/repositories/IUserRepository";
import { IPasswordHasher } from "@application/auth/abstractions/services/IPasswordHasher";
import { IAuthTokenService } from "@application/auth/abstractions/services/IAuthTokenService";

/**
 * Use case de connexion d'un utilisateur existant.
 *
 * Orchestration pure : retrouve l'utilisateur par e-mail, vérifie le mot de passe, puis
 * délègue l'émission des jetons au service partagé. En cas d'e-mail inconnu OU de mot de
 * passe incorrect, renvoie une seule et même erreur métier pour ne pas révéler quel champ
 * est en cause (protection contre l'énumération).
 */
export class LoginUserUseCase implements ILoginUserUseCase {
  /**
   * @param userRepository - Port de persistance des utilisateurs.
   * @param passwordHasher - Port de comparaison du mot de passe.
   * @param authTokenService - Service partagé d'émission des jetons.
   */
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly authTokenService: IAuthTokenService,
  ) {}

  /**
   * @inheritdoc
   */
  public async execute(command: LoginUserCommand): Promise<Result<LoginUserResult, AppError>> {
    const email = Email.create(command.email);
    const user = await this.userRepository.findByEmail(email);

    if (user === null) {
      return Result.failure(new InvalidCredentialsError());
    }

    const passwordMatches = await user.verifyPassword(
      command.password,
      (plain, hash) => this.passwordHasher.compare(plain, hash),
    );

    if (!passwordMatches) {
      return Result.failure(new InvalidCredentialsError());
    }

    const tokens = await this.authTokenService.issueTokensForUser(user);

    return Result.success({
      userId: user.id,
      email: user.email.value,
      tokens,
    });
  }
}
