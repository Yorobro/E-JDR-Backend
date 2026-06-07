import { User } from "@domain/auth/entities/User";
import { Credential } from "@domain/auth/entities/Credential";
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
import { ICredentialRepository } from "@application/auth/abstractions/repositories/ICredentialRepository";
import { IPasswordHasher } from "@application/auth/abstractions/services/IPasswordHasher";
import { IIdGenerator } from "@application/auth/abstractions/services/IIdGenerator";
import { IAuthTokenService } from "@application/auth/abstractions/services/IAuthTokenService";

/**
 * Use case d'inscription d'un nouvel utilisateur.
 *
 * Orchestration pure : valide les entrées via le domaine, vérifie l'unicité de l'e-mail,
 * crée l'**identité métier** (`User`) puis l'**identifiant d'authentification** (`Credential`)
 * qui lui est rattaché, persiste les deux, et connecte directement en déléguant l'émission
 * des jetons au service partagé `IAuthTokenService`.
 */
export class RegisterUserUseCase implements IRegisterUserUseCase {
  /**
   * @param userRepository - Port de persistance des utilisateurs métier.
   * @param credentialRepository - Port de persistance des identifiants d'authentification.
   * @param passwordHasher - Port de hachage du mot de passe.
   * @param idGenerator - Port de génération des identifiants.
   * @param authTokenService - Service partagé d'émission des jetons (connexion directe).
   */
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly credentialRepository: ICredentialRepository,
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

    if (await this.credentialRepository.existsByEmail(email)) {
      return Result.failure(new EmailAlreadyUsedError());
    }

    const user = User.create({ id: this.idGenerator.generate(), createdAt: new Date() });
    const credential = await this.buildCredential(user.id, email, plainPassword);

    await this.userRepository.save(user);
    await this.credentialRepository.save(credential);

    const tokens = await this.authTokenService.issueTokens(user.id, email.value);

    return Result.success({
      userId: user.id,
      email: credential.email.value,
      tokens,
    });
  }

  /**
   * Construit l'identifiant d'authentification rattaché à un utilisateur : hache le mot de
   * passe et génère l'identifiant et la date de création de l'enregistrement.
   *
   * @param userId - L'identifiant de l'utilisateur métier rattaché.
   * @param email - L'e-mail validé du futur compte.
   * @param plainPassword - Le mot de passe en clair validé à hacher.
   * @returns L'entité `Credential` nouvellement créée.
   */
  private async buildCredential(
    userId: string,
    email: Email,
    plainPassword: PlainPassword,
  ): Promise<Credential> {
    const hash = await this.passwordHasher.hash(plainPassword.value);

    return Credential.create({
      id: this.idGenerator.generate(),
      userId,
      email,
      password: HashedPassword.fromHash(hash),
      createdAt: new Date(),
    });
  }
}
