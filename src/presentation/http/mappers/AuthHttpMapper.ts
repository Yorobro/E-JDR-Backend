import { CookieOptions, Request, Response } from "express";
import { AppError } from "@application/errors/AppError";
import { AuthTokens } from "@application/auth/abstractions/services/IAuthTokenService";

/** Nom du cookie portant l'access token. */
export const ACCESS_TOKEN_COOKIE = "access_token";
/** Nom du cookie portant le refresh token. */
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/**
 * Mappe les éléments HTTP (requête/réponse, cookies) vers/depuis les types applicatifs.
 *
 * Confine ici toute la connaissance du transport (cookies httpOnly, codes HTTP), afin que
 * le controller reste centré sur l'orchestration. Toutes les méthodes sont statiques.
 */
export class AuthHttpMapper {
  /**
   * Construit les options de cookie communes, en activant `secure` uniquement en production.
   *
   * @param isProduction - Indique si l'on tourne en production (HTTPS requis pour `secure`).
   * @param expiresAt - Date d'expiration du cookie.
   * @returns Les options de cookie à appliquer.
   */
  private static cookieOptions(isProduction: boolean, expiresAt: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      expires: expiresAt,
      path: "/",
    };
  }

  /**
   * Positionne les cookies httpOnly d'access et de refresh sur la réponse.
   *
   * @param res - La réponse Express.
   * @param tokens - La paire de jetons à déposer.
   * @param isProduction - Indique si l'on tourne en production (impacte `secure`).
   */
  public static setAuthCookies(res: Response, tokens: AuthTokens, isProduction: boolean): void {
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      tokens.accessToken,
      AuthHttpMapper.cookieOptions(isProduction, tokens.accessTokenExpiresAt),
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      tokens.refreshToken,
      AuthHttpMapper.cookieOptions(isProduction, tokens.refreshTokenExpiresAt),
    );
  }

  /**
   * Efface les cookies d'authentification (déconnexion).
   *
   * @param res - La réponse Express.
   */
  public static clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
  }

  /**
   * Récupère le refresh token depuis les cookies de la requête.
   *
   * @param req - La requête Express.
   * @returns Le refresh token, ou `null` s'il est absent.
   */
  public static readRefreshToken(req: Request): string | null {
    const token = (req.cookies as Record<string, string | undefined>)[REFRESH_TOKEN_COOKIE];
    return token ?? null;
  }

  /**
   * Traduit un code d'erreur applicative en code de statut HTTP.
   *
   * @param error - L'erreur applicative à traduire.
   * @returns Le code HTTP correspondant.
   */
  public static toHttpStatus(error: AppError): number {
    switch (error.code) {
      case "EMAIL_ALREADY_USED":
        return 409;
      case "INVALID_CREDENTIALS":
      case "INVALID_REFRESH_TOKEN":
        return 401;
      case "ACCOUNT_LOCKED":
        return 429;
      default:
        return 400;
    }
  }
}
