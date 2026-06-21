import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { InvalidRefreshTokenError } from "@application/features/auth/errors/InvalidRefreshTokenError";
import { RefreshAccessTokenCommand } from "@application/features/auth/commands/RefreshAccessTokenCommand";
import {
  RefreshAccessTokenUseCase,
  RefreshAccessTokenResult,
} from "@application/features/auth/abstractions/usecases/RefreshAccessTokenUseCase";
import { UserRepository } from "@application/features/auth/abstractions/repositories/UserRepository";
import {
  RefreshTokenRepository,
  StoredRefreshToken,
} from "@application/features/auth/abstractions/repositories/RefreshTokenRepository";
import { TokenProviderService } from "@application/features/auth/abstractions/services/TokenProviderService";
import { TokenHasherService } from "@application/features/auth/abstractions/services/TokenHasherService";
import { AuthTokenService } from "@application/features/auth/abstractions/services/AuthTokenService";

/**
 * Use case de rafraîchissement de l'access token (sans rotation du refresh token).
 *
 * Orchestration pure :
 * 1. vérifie la signature/expiration du refresh token (cryptographique) ;
 * 2. vérifie sa présence en base ET sa non-expiration (un token absent = révoqué) ;
 * 3. vérifie que l'utilisateur existe toujours ;
 * 4. émet **uniquement** un nouvel access token via le service partagé.
 *
 * Le refresh token n'est **pas** révoqué ni régénéré : la session de l'appareil reste
 * intacte. C'est ce qui permet à plusieurs appareils du même utilisateur de rester connectés
 * en parallèle — rafraîchir l'un n'invalide pas les autres (pas de rotation destructive).
 *
 * Toute incohérence (signature, expiration, absence en base, utilisateur introuvable)
 * renvoie une unique erreur métier {@link InvalidRefreshTokenError}.
 */
export class RefreshAccessTokenUseCaseImpl implements RefreshAccessTokenUseCase {
  /**
   * @param userRepository - Port de persistance des utilisateurs.
   * @param refreshTokenRepository - Port de persistance des refresh tokens.
   * @param tokenProvider - Port de vérification du refresh token.
   * @param tokenHasher - Port de hachage déterministe (recherche par empreinte).
   * @param authTokenService - Service partagé d'émission des jetons.
   */
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenProvider: TokenProviderService,
    private readonly tokenHasher: TokenHasherService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  /**
   * @inheritdoc
   */
  public async execute(
    command: RefreshAccessTokenCommand,
  ): Promise<Result<RefreshAccessTokenResult, AppError>> {
    const payload = this.tokenProvider.verifyRefreshToken(command.refreshToken);
    if (payload === null) {
      return Result.failure(new InvalidRefreshTokenError());
    }

    const stored = await this.findStoredRefreshToken(command.refreshToken);
    // Token absent (révoqué/inexistant) OU expiré en base : on refuse. La non-expiration est
    // déjà garantie cryptographiquement par `verifyRefreshToken`, mais on la revérifie ici en
    // base par défense en profondeur (le token n'étant plus systématiquement supprimé).
    if (stored === null || stored.expiresAt.getTime() <= Date.now()) {
      return Result.failure(new InvalidRefreshTokenError());
    }

    // L'utilisateur est rechargé par son identifiant (claim `userId`), clé naturelle de
    // l'identité métier ; on s'assure qu'il existe toujours avant de réémettre un access token.
    const user = await this.userRepository.findById(payload.userId);
    if (user === null) {
      return Result.failure(new InvalidRefreshTokenError());
    }

    // Émission du seul access token : le refresh token en base reste inchangé (pas de rotation).
    const accessToken = this.authTokenService.issueAccessToken(payload.userId, payload.email);

    await this.purgeExpiredTokens();

    return Result.success({ accessToken });
  }

  /**
   * Purge d'entretien, opportuniste : supprime les refresh tokens déjà expirés.
   *
   * Greffée sur le flux de rafraîchissement (événement peu fréquent) pour éviter une
   * croissance illimitée de la table sans introduire de planificateur. Best-effort : une
   * éventuelle erreur de purge ne doit pas faire échouer le rafraîchissement lui-même.
   */
  private async purgeExpiredTokens(): Promise<void> {
    try {
      await this.refreshTokenRepository.deleteExpired(new Date());
    } catch {
      // Purge non critique : on ignore silencieusement un échec de maintenance.
    }
  }

  /**
   * Retrouve l'enregistrement d'un refresh token à partir de son empreinte.
   *
   * @param rawRefreshToken - Le refresh token brut.
   * @returns L'enregistrement stocké, ou `null` s'il est absent (donc révoqué/inexistant).
   */
  private async findStoredRefreshToken(
    rawRefreshToken: string,
  ): Promise<StoredRefreshToken | null> {
    const tokenHash = this.tokenHasher.hash(rawRefreshToken);
    return this.refreshTokenRepository.findByTokenHash(tokenHash);
  }
}
