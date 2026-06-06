import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import {
  ITokenProvider,
  SignedToken,
  TokenPayload,
} from "@application/auth/abstractions/services/ITokenProvider";

/**
 * Configuration nécessaire au provider JWT : secrets et durées de vie distincts pour
 * les access tokens et les refresh tokens.
 */
export interface JwtConfig {
  /** Secret de signature des access tokens. */
  readonly accessSecret: string;
  /** Secret de signature des refresh tokens (différent de l'access). */
  readonly refreshSecret: string;
  /** Durée de vie de l'access token (format `jsonwebtoken`, ex : `"15m"`). */
  readonly accessExpiresIn: string;
  /** Durée de vie du refresh token (format `jsonwebtoken`, ex : `"7d"`). */
  readonly refreshExpiresIn: string;
}

/**
 * Implémentation du port `ITokenProvider` basée sur **jsonwebtoken**.
 *
 * Seul endroit de l'application qui dépend de la librairie JWT et des secrets. Gère la
 * signature et la vérification des deux types de tokens avec des secrets distincts.
 */
export class JwtTokenProvider implements ITokenProvider {
  /**
   * @param config - Secrets et durées de vie des tokens.
   */
  constructor(private readonly config: JwtConfig) {}

  /**
   * @inheritdoc
   */
  public signAccessToken(payload: TokenPayload): SignedToken {
    return this.sign(payload, this.config.accessSecret, this.config.accessExpiresIn);
  }

  /**
   * @inheritdoc
   */
  public signRefreshToken(payload: TokenPayload): SignedToken {
    return this.sign(payload, this.config.refreshSecret, this.config.refreshExpiresIn);
  }

  /**
   * @inheritdoc
   */
  public verifyAccessToken(token: string): TokenPayload | null {
    return this.verify(token, this.config.accessSecret);
  }

  /**
   * @inheritdoc
   */
  public verifyRefreshToken(token: string): TokenPayload | null {
    return this.verify(token, this.config.refreshSecret);
  }

  /**
   * Signe un token avec un secret et une durée donnés, et calcule sa date d'expiration.
   *
   * @param payload - Les claims applicatifs à encoder.
   * @param secret - Le secret de signature.
   * @param expiresIn - La durée de vie (format `jsonwebtoken`).
   * @returns Le token signé et sa date d'expiration.
   */
  private sign(payload: TokenPayload, secret: string, expiresIn: string): SignedToken {
    const options = { expiresIn } as SignOptions;
    const token = jwt.sign({ userId: payload.userId, email: payload.email }, secret, options);
    return { token, expiresAt: this.readExpiry(token, secret) };
  }

  /**
   * Vérifie et décode un token, en extrayant les claims applicatifs.
   *
   * @param token - Le token à vérifier.
   * @param secret - Le secret attendu pour la vérification.
   * @returns La charge utile applicative, ou `null` si le token est invalide/expiré.
   */
  private verify(token: string, secret: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, secret);
      return this.extractPayload(decoded);
    } catch {
      // Signature invalide, token expiré ou malformé : échec métier, pas technique.
      return null;
    }
  }

  /**
   * Extrait et valide les claims applicatifs d'un token décodé.
   *
   * @param decoded - Le contenu décodé renvoyé par `jsonwebtoken`.
   * @returns La charge utile applicative, ou `null` si les claims attendus sont absents.
   */
  private extractPayload(decoded: string | JwtPayload): TokenPayload | null {
    if (typeof decoded === "string") {
      return null;
    }

    const userId = decoded["userId"];
    const email = decoded["email"];

    if (typeof userId !== "string" || typeof email !== "string") {
      return null;
    }

    return { userId, email };
  }

  /**
   * Lit la date d'expiration (`exp`) effective d'un token fraîchement signé.
   *
   * @param token - Le token signé.
   * @param secret - Le secret ayant servi à la signature.
   * @returns La date d'expiration absolue du token.
   */
  private readExpiry(token: string, secret: string): Date {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    const expSeconds = decoded.exp ?? 0;
    return new Date(expSeconds * 1000);
  }
}
