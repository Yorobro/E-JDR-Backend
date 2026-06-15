import { User } from "@domain/features/auth/entities/User";
import { Credential } from "@domain/features/auth/entities/Credential";
import { Email } from "@domain/features/auth/value-objects/Email";
import { Pseudo } from "@domain/features/auth/value-objects/Pseudo";
import { PlainPassword } from "@domain/features/auth/value-objects/PlainPassword";
import { HashedPassword } from "@domain/features/auth/value-objects/HashedPassword";
import { DomainError } from "@domain/shared/errors/DomainError";

import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { Logger } from "@application/shared/Logger";
import { EmailAlreadyUsedError } from "@application/features/auth/errors/EmailAlreadyUsedError";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import { RegisterUserCommand } from "@application/features/auth/commands/RegisterUserCommand";
import {
  RegisterUserUseCase,
  RegisterUserResult,
} from "@application/features/auth/abstractions/usecases/RegisterUserUseCase";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import { PasswordHasherService } from "@application/features/auth/abstractions/services/PasswordHasherService";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { AuthTokenService } from "@application/features/auth/abstractions/services/AuthTokenService";
import { UnitOfWork } from "@application/shared/UnitOfWork";

/**
 * Use case d'inscription d'un nouvel utilisateur.
 *
 * Orchestration pure : valide les entrées via le domaine, vérifie l'unicité de l'e-mail,
 * crée l'**identité métier** (`User`) puis l'**identifiant d'authentification** (`Credential`)
 * qui lui est rattaché, persiste les deux, et connecte directement en déléguant l'émission
 * des jetons au service partagé `AuthTokenService`.
 */
export class RegisterUserUseCaseImpl implements RegisterUserUseCase {
  constructor(
    private readonly credentialRepository: CredentialRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly idGenerator: IdGeneratorService,
    private readonly authTokenService: AuthTokenService,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(
    command: RegisterUserCommand,
  ): Promise<Result<RegisterUserResult, AppError>> {
    let email: Email;
    let pseudo: Pseudo;
    let plainPassword: PlainPassword;

    try {
      email = Email.create(command.email);
      pseudo = Pseudo.create(command.pseudo);
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

    const user = User.create({
      id: this.idGenerator.generate(),
      pseudo: pseudo.value,
      createdAt: new Date(),
    });
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
      pseudo: user.pseudo,
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
