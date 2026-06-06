import { User } from "@domain/auth/entities/User";
import { Email } from "@domain/auth/value-objects/Email";
import { HashedPassword } from "@domain/auth/value-objects/HashedPassword";

import { IUserRepository } from "@application/auth/abstractions/repositories/IUserRepository";
import {
  IRefreshTokenRepository,
  StoredRefreshToken,
} from "@application/auth/abstractions/repositories/IRefreshTokenRepository";
import { IPasswordHasher } from "@application/auth/abstractions/services/IPasswordHasher";
import { IIdGenerator } from "@application/auth/abstractions/services/IIdGenerator";
import { ITokenHasher } from "@application/auth/abstractions/services/ITokenHasher";
import {
  ITokenProvider,
  SignedToken,
  TokenPayload,
} from "@application/auth/abstractions/services/ITokenProvider";
import {
  AuthTokens,
  IAuthTokenService,
} from "@application/auth/abstractions/services/IAuthTokenService";

/**
 * Fabriques de doublures de test (fakes) pour les ports applicatifs.
 *
 * Ces implémentations en mémoire permettent de tester les use cases en isolation, sans BDD
 * ni cryptographie réelle. Elles respectent strictement les interfaces (ports), exactement
 * comme les implémentations d'infrastructure.
 */

/** Repository utilisateur en mémoire. */
export class FakeUserRepository implements IUserRepository {
  private readonly users = new Map<string, User>();

  public async findByEmail(email: Email): Promise<User | null> {
    return this.users.get(email.value) ?? null;
  }

  public async existsByEmail(email: Email): Promise<boolean> {
    return this.users.has(email.value);
  }

  public async save(user: User): Promise<void> {
    this.users.set(user.email.value, user);
  }

  /** Aide de test : pré-remplit le repository avec un utilisateur. */
  public seed(user: User): void {
    this.users.set(user.email.value, user);
  }
}

/** Repository de refresh tokens en mémoire. */
export class FakeRefreshTokenRepository implements IRefreshTokenRepository {
  public readonly tokens = new Map<string, StoredRefreshToken>();

  public async save(token: StoredRefreshToken): Promise<void> {
    this.tokens.set(token.tokenHash, token);
  }

  public async findByTokenHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.tokens.get(tokenHash) ?? null;
  }

  public async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.tokens.delete(tokenHash);
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    for (const [hash, token] of this.tokens.entries()) {
      if (token.userId === userId) {
        this.tokens.delete(hash);
      }
    }
  }
}

/** Hasher de mot de passe factice : préfixe "hashed:" et compare en conséquence. */
export class FakePasswordHasher implements IPasswordHasher {
  public async hash(plainPassword: string): Promise<string> {
    return `hashed:${plainPassword}`;
  }

  public async compare(plainPassword: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plainPassword}`;
  }
}

/** Générateur d'identifiants déterministe (incrémental). */
export class FakeIdGenerator implements IIdGenerator {
  private counter = 0;

  public generate(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

/** Hasher de token déterministe factice. */
export class FakeTokenHasher implements ITokenHasher {
  public hash(token: string): string {
    return `thash:${token}`;
  }
}

/** Provider de tokens factice : encode le payload en JSON, validité contrôlable. */
export class FakeTokenProvider implements ITokenProvider {
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

/** Service de tokens factice : produit une paire fixe et trace les utilisateurs servis. */
export class FakeAuthTokenService implements IAuthTokenService {
  public readonly issuedFor: string[] = [];

  public async issueTokensForUser(user: User): Promise<AuthTokens> {
    this.issuedFor.push(user.id);
    return {
      accessToken: `access-for-${user.id}`,
      accessTokenExpiresAt: new Date("2999-01-01"),
      refreshToken: `refresh-for-${user.id}`,
      refreshTokenExpiresAt: new Date("2999-01-01"),
    };
  }
}

/**
 * Aide de test : construit un utilisateur avec un mot de passe déjà "haché" par le fake hasher.
 *
 * @param email - L'e-mail de l'utilisateur.
 * @param plainPassword - Le mot de passe en clair (sera préfixé "hashed:").
 * @param id - L'identifiant (par défaut "user-1").
 * @returns Une entité `User` prête pour les tests.
 */
export function buildTestUser(email: string, plainPassword: string, id = "user-1"): User {
  return User.create({
    id,
    email: Email.create(email),
    password: HashedPassword.fromHash(`hashed:${plainPassword}`),
    createdAt: new Date("2025-01-01T00:00:00Z"),
  });
}
