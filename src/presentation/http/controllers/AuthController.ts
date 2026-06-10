import { NextFunction, Request, Response } from "express";

import { AppConfig } from "@config/env";
import { AppError } from "@application/errors/AppError";

import { RegisterUserUseCase } from "@application/features/auth/abstractions/usecases/RegisterUserUseCase";
import { LoginUserUseCase } from "@application/features/auth/abstractions/usecases/LoginUserUseCase";
import { LogoutUserUseCase } from "@application/features/auth/abstractions/usecases/LogoutUserUseCase";
import { RefreshAccessTokenUseCase } from "@application/features/auth/abstractions/usecases/RefreshAccessTokenUseCase";

import { AuthHttpMapper } from "@presentation/http/mappers/AuthHttpMapper";

/**
 * Controller HTTP des routes d'authentification.
 *
 * Il dépend uniquement des **interfaces** de use cases (et non de leurs implémentations),
 * conformément à l'inversion de dépendance. Son rôle se limite à : extraire les données de
 * la requête, appeler le use case, inspecter le `Result`, puis traduire en réponse HTTP
 * (cookies, codes). Les erreurs techniques imprévues sont transmises au middleware d'erreurs.
 */
export class AuthController {
  /**
   * @param registerUser - Use case d'inscription.
   * @param loginUser - Use case de connexion.
   * @param logoutUser - Use case de déconnexion.
   * @param refreshAccessToken - Use case de rafraîchissement.
   * @param config - Configuration applicative (pour le flag `secure` des cookies).
   */
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly logoutUser: LogoutUserUseCase,
    private readonly refreshAccessToken: RefreshAccessTokenUseCase,
    private readonly config: AppConfig,
  ) {}

  /**
   * `POST /auth/register` — inscrit un utilisateur puis le connecte directement.
   *
   * @param req - La requête (corps : `{ email, password }`).
   * @param res - La réponse.
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.registerUser.execute({
        email: req.body?.email,
        password: req.body?.password,
      });

      if (result.isFailure) {
        this.sendAppError(res, result.error);
        return;
      }

      AuthHttpMapper.setAuthCookies(res, result.value.tokens, this.config.isProduction);
      res.status(201).json({ userId: result.value.userId, email: result.value.email });
    } catch (error) {
      this.handleThrownError(error, res, next);
    }
  };

  /**
   * `POST /auth/login` — authentifie un utilisateur et pose les cookies.
   *
   * @param req - La requête (corps : `{ email, password }`).
   * @param res - La réponse.
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.loginUser.execute({
        email: req.body?.email,
        password: req.body?.password,
      });

      if (result.isFailure) {
        this.sendAppError(res, result.error);
        return;
      }

      AuthHttpMapper.setAuthCookies(res, result.value.tokens, this.config.isProduction);
      res.status(200).json({ userId: result.value.userId, email: result.value.email });
    } catch (error) {
      this.handleThrownError(error, res, next);
    }
  };

  /**
   * `POST /auth/refresh` — régénère les jetons à partir du cookie refresh (rotation).
   *
   * @param req - La requête (cookie `refresh_token`).
   * @param res - La réponse.
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = AuthHttpMapper.readRefreshToken(req) ?? "";

      const result = await this.refreshAccessToken.execute({ refreshToken });

      if (result.isFailure) {
        AuthHttpMapper.clearAuthCookies(res);
        this.sendAppError(res, result.error);
        return;
      }

      AuthHttpMapper.setAuthCookies(res, result.value.tokens, this.config.isProduction);
      res.status(200).json({ message: "Jetons rafraîchis." });
    } catch (error) {
      this.handleThrownError(error, res, next);
    }
  };

  /**
   * `POST /auth/logout` — révoque le refresh token et efface les cookies.
   *
   * @param req - La requête (cookie `refresh_token`).
   * @param res - La réponse.
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = AuthHttpMapper.readRefreshToken(req);

      if (refreshToken !== null) {
        await this.logoutUser.execute({ refreshToken });
      }

      AuthHttpMapper.clearAuthCookies(res);
      res.status(200).json({ message: "Déconnexion réussie." });
    } catch (error) {
      this.handleThrownError(error, res, next);
    }
  };

  /**
   * Écrit une réponse d'erreur métier (issue d'un `Result.failure`) avec le bon code HTTP.
   *
   * @param res - La réponse Express.
   * @param error - L'erreur applicative à transmettre.
   */
  private sendAppError(res: Response, error: AppError): void {
    const status = AuthHttpMapper.toHttpStatus(error);
    res.status(status).json({ code: error.code, message: error.message });
  }

  /**
   * Relaie une exception technique imprévue au middleware d'erreurs (→ 500).
   * Les erreurs métier attendues sont transportées via `Result` et ne passent pas ici.
   */
  private handleThrownError(error: unknown, _res: Response, next: NextFunction): void {
    next(error);
  }
}
