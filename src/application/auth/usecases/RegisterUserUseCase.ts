import { User } from "@domain/auth/entities/User";
import { Email } from "@domain/auth/value-objects/Email";
import { PlainPassword } from "@domain/auth/value-objects/PlainPassword";
import { HashedPassword } from "@domain/auth/value-objects/HashedPassword";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { EmailAlreadyUsedError } from "@application/auth/errors/EmailAlreadyUsedError";
import { RegisterUserCommand } from "@application/auth/commands/RegisterUserCommand";
import {
  IRegisterUserUseCase,
  RegisterUserResult,
} from "@application/auth/abstractions/usecases/IRegisterUserUseCase";
import { IUserRepository } from "@application/auth/abstractions/repositories/IUserRepository";
import { IPasswordHasher } from "@application/auth/abstractions/services/IPasswordHasher";
import { IIdGenerator } from "@application/auth/abstractions/services/IIdGenerator";
import { IAuthTokenService } from "@application/auth/abstractions/services/IAuthTokenService";

/**
 * Use case d'inscription d'un nouvel utilisateur.
 *
 * Orchestration pure : valide les entrées via le domaine, vérifie l'unicité de l'e-mail,
 * hache le mot de passe, crée et persiste l'utilisateur, puis le connecte directement en
 * déléguant l'émission des jetons au service partagé `IAuthTokenService`.
 */
export class RegisterUserUseCase implements IRegisterUserUseCase {
  /**
   * @param userRepository - Port de persistance des utilisateurs.
   * @param passwordHasher - Port de hachage du mot de passe.
   * @param idGenerator - Port de génération de l'identifiant utilisateur.
   * @param authTokenService - Service partagé d'émission des jetons (connexion directe).
   */
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly idGenerator: IIdGenerator,
    private readonly authTokenService: IAuthTokenService,
  ) {}

  /**
   * @inheritdoc
   */
  public async execute(
    command: RegisterUserCommand,
  ): Promise<Result<RegisterUserResult, AppError>> {
    // Validation de format déléguée au domaine (peut lever DomainError -> géré en amont).
    const email = Email.create(command.email);
    const plainPassword = PlainPassword.create(command.password);

    if (await this.userRepository.existsByEmail(email)) {
      return Result.failure(new EmailAlreadyUsedError());
    }

    const user = await this.buildUser(email, plainPassword);
    await this.userRepository.save(user);

    const tokens = await this.authTokenService.issueTokensForUser(user);

    return Result.success({
      userId: user.id,
      email: user.email.value,
      tokens,
    });
  }

  /**
   * Construit une entité `User` prête à être persistée : hache le mot de passe et
   * génère l'identifiant et la date de création.
   *
   * @param email - L'e-mail validé du futur utilisateur.
   * @param plainPassword - Le mot de passe en clair validé à hacher.
   * @returns L'entité `User` nouvellement créée.
   */
  private async buildUser(email: Email, plainPassword: PlainPassword): Promise<User> {
    const hash = await this.passwordHasher.hash(plainPassword.value);

    return User.create({
      id: this.idGenerator.generate(),
      email,
      password: HashedPassword.fromHash(hash),
      createdAt: new Date(),
    });
  }
}
