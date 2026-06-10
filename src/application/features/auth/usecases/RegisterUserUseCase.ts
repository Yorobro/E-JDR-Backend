import { User } from "@domain/features/auth/entities/User";
import { Credential } from "@domain/features/auth/entities/Credential";
import { Email } from "@domain/features/auth/value-objects/Email";
import { PlainPassword } from "@domain/features/auth/value-objects/PlainPassword";
import { HashedPassword } from "@domain/features/auth/value-objects/HashedPassword";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { ILogger } from "@application/shared/ILogger";
import { EmailAlreadyUsedError } from "@application/features/auth/errors/EmailAlreadyUsedError";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { RegisterUserCommand } from "@application/features/auth/commands/RegisterUserCommand";
import {
  IRegisterUserUseCase,
  RegisterUserResult,
} from "@application/features/auth/abstractions/usecases/IRegisterUserUseCase";
import { ICredentialRepository } from "@application/features/auth/abstractions/repositories/ICredentialRepository";
import { IPasswordHasher } from "@application/features/auth/abstractions/services/IPasswordHasher";
import { IIdGenerator } from "@application/features/auth/abstractions/services/IIdGenerator";
import { IAuthTokenService } from "@application/features/auth/abstractions/services/IAuthTokenService";
import { IUnitOfWork } from "@application/shared/IUnitOfWork";

/**
 * Use case d'inscription d'un nouvel utilisateur.
 *
 * Orchestration pure : valide les entrées via le domaine, vérifie l'unicité de l'e-mail,
 * crée l'**identité métier** (`User`) puis l'**identifiant d'authentification** (`Credential`)
 * qui lui est rattaché, persiste les deux, et connecte directement en déléguant l'émission
 * des jetons au service partagé `IAuthTokenService`.
 */
export class RegisterUserUseCase implements IRegisterUserUseCase {
  constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly idGenerator: IIdGenerator,
    private readonly authTokenService: IAuthTokenService,
    private readonly unitOfWork: IUnitOfWork,
    private readonly logger: ILogger,
  ) {}

  public async execute(
    command: RegisterUserCommand,
  ): Promise<Result<RegisterUserResult, AppError>> {
    let email: Email;
    let plainPassword: PlainPassword;

    try {
      email = Email.create(command.email);
      plainPassword = PlainPassword.create(command.password);
    } catch (error) {
      if (error instanceof DomainError) {
        return Result.failure(new InvalidInputError(error.code, error.message));
      }
      throw error;
    }

    if (await this.credentialRepository.existsByEmail(email)) {
      this.logger.warn("Tentative d'inscription avec un e-mail déjà utilisé", {
        email: email.value,
      });
      return Result.failure(new EmailAlreadyUsedError());
    }

    const user = User.create({ id: this.idGenerator.generate(), createdAt: new Date() });
    const credential = await this.buildCredential(user.id, email, plainPassword);

    await this.unitOfWork.execute(async (repos) => {
      await repos.users.save(user);
      await repos.credentials.save(credential);
    });

    const tokens = await this.authTokenService.issueTokens(user.id, email.value);

    this.logger.info("Inscription réussie", { userId: user.id });

    return Result.success({
      userId: user.id,
      email: credential.email.value,
      tokens,
    });
  }

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


