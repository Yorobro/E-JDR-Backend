import { Logger } from "@application/shared/Logger";
import { RefreshTokenRepository } from "@application/features/auth/abstractions/repositories/RefreshTokenRepository";
import { PasswordHasherService } from "@application/features/auth/abstractions/services/PasswordHasherService";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { TokenHasherService } from "@application/features/auth/abstractions/services/TokenHasherService";
import {
  TokenProviderService,
  SignedToken,
  TokenPayload,
} from "@application/features/auth/abstractions/services/TokenProviderService";
import {
  AuthTokens,
  AuthTokenService,
} from "@application/features/auth/abstractions/services/AuthTokenService";
import { CharacterSheetPdfGenerator } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfGenerator";
import { CharacterSheetPdfReferences } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfReferences";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";

/**
 * Doublures de **services** (hash, tokens, id, pdf, logger), extraites de `fakes.ts` pour la
 * taille de fichier. Re-exportées par `fakes.ts` pour ne pas casser les imports existants.
 */

/** Hasher de mot de passe factice : préfixe "hashed:" et compare en conséquence. */
export class FakePasswordHasher implements PasswordHasherService {
  public async hash(plainPassword: string): Promise<string> {
    return `hashed:${plainPassword}`;
  }

  public async compare(plainPassword: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plainPassword}`;
  }
}

/** Générateur d'identifiants déterministe (incrémental). */
export class FakeIdGenerator implements IdGeneratorService {
  private counter = 0;

  public generate(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

/** Hasher de token déterministe factice. */
export class FakeTokenHasher implements TokenHasherService {
  public hash(token: string): string {
    return `thash:${token}`;
  }
}

/** Provider de tokens factice : encode le payload en JSON, validité contrôlable. */
export class FakeTokenProvider implements TokenProviderService {
  /** Permet de simuler un refresh token invalide dans les tests. */
  public refreshTokenValid = true;

  public signAccessToken(payload: TokenPayload): SignedToken {
    return { token: `access:${JSON.stringify(payload)}`, expiresAt: new Date("2999-01-01") };
  }

  public signRefreshToken(payload: TokenPayload): SignedToken {
    return { token: `refresh:${JSON.stringify(payload)}`, expiresAt: new Date("2999-01-01") };
  }

  public verifyAccessToken(token: string): TokenPayload | null {
    return this.decode(token, "access:");
  }

  public verifyRefreshToken(token: string): TokenPayload | null {
    if (!this.refreshTokenValid) {
      return null;
    }
    return this.decode(token, "refresh:");
  }

  private decode(token: string, prefix: string): TokenPayload | null {
    if (!token.startsWith(prefix)) {
      return null;
    }
    return JSON.parse(token.slice(prefix.length)) as TokenPayload;
  }
}

/** Service de tokens factice : produit une paire fixe et trace les identités servies. */
export class FakeAuthTokenService implements AuthTokenService {
  public readonly issuedFor: string[] = [];

  public async issueTokens(
    userId: string,
    _email: string,
    _refreshTokenRepo?: RefreshTokenRepository,
  ): Promise<AuthTokens> {
    this.issuedFor.push(userId);
    return {
      accessToken: `access-for-${userId}`,
      accessTokenExpiresAt: new Date("2999-01-01"),
      refreshToken: `refresh-for-${userId}`,
      refreshTokenExpiresAt: new Date("2999-01-01"),
    };
  }
}

/** Générateur PDF factice : renvoie un Buffer commençant par l'en-tête PDF, sans rendu réel. */
export class FakeCharacterSheetPdfGenerator implements CharacterSheetPdfGenerator {
  /** Dernier `detail` reçu par {@link generate} (pour inspection dans les tests). */
  public lastDetail: CharacterSheetDetail | null = null;
  /** Dernières `references` reçues par {@link generate} (pour inspection dans les tests). */
  public lastReferences: CharacterSheetPdfReferences | null = null;

  public async generate(
    detail: CharacterSheetDetail,
    references: CharacterSheetPdfReferences,
  ): Promise<Buffer> {
    this.lastDetail = detail;
    this.lastReferences = references;
    return Buffer.from("%PDF-fake");
  }
}

/** Logger no-op pour les tests : absorbe silencieusement tous les appels. */
export class FakeLogger implements Logger {
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public debug(): void {}
  public child(): Logger {
    return this;
  }
}
