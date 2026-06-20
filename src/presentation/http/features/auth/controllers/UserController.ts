import { NextFunction, Request, Response } from "express";
import { GetCurrentUserUseCase } from "@application/features/auth/abstractions/usecases/GetCurrentUserUseCase";
import { ChangeEmailUseCase } from "@application/features/auth/abstractions/usecases/ChangeEmailUseCase";
import { ChangePasswordUseCase } from "@application/features/auth/abstractions/usecases/ChangePasswordUseCase";
import { AppError } from "@application/errors/AppError";

/**
 * Controller HTTP des routes utilisateur protégées.
 *
 * Monté derrière le middleware d'authentification : `req.user` est donc toujours
 * renseigné ici. Comme `AuthController`, il ne dépend que des interfaces de use cases.
 */
export class UserController {
  /**
   * @param getCurrentUser - Use case de consultation du profil courant.
   * @param changeEmail - Use case de changement d'e-mail.
   * @param changePassword - Use case de changement de mot de passe.
   */
  constructor(
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly changeEmail: ChangeEmailUseCase,
    private readonly changePassword: ChangePasswordUseCase,
  ) {}

  /**
   * `GET /me` — renvoie le profil de l'utilisateur authentifié.
   *
   * `UserNotFoundError` est traduite en **401** (et non 404) : un jeton valide pour
   * un compte disparu signifie que la session n'est plus valide — le client doit
   * se déconnecter.
   *
   * @param req - La requête (identité dans `req.user`, posée par le middleware).
   * @param res - La réponse.
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getCurrentUser.execute({ userId: req.user!.userId });

      if (result.isFailure) {
        res.status(401).json({ code: result.error.code, message: result.error.message });
        return;
      }

      const { userId, email, pseudo, createdAt } = result.value;
      res.status(200).json({ userId, email, pseudo, createdAt: createdAt.toISOString() });
    } catch (error) {
      next(error);
    }
  };

  /**
   * `PATCH /me/email` — modifie l'adresse e-mail de l'utilisateur authentifié.
   *
   * @param req - La requête (corps `{ email }`, identité dans `req.user`).
   * @param res - La réponse.
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public patchEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.changeEmail.execute({
        userId: req.user!.userId,
        newEmail: (req.body as { email?: string }).email ?? "",
      });
      if (result.isFailure) {
        res
          .status(UserController.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  };

  /**
   * `PATCH /me/password` — modifie le mot de passe de l'utilisateur authentifié.
   *
   * @param req - La requête (corps `{ currentPassword, newPassword }`, identité dans `req.user`).
   * @param res - La réponse.
   * @param next - Relais vers le middleware d'erreurs pour les exceptions techniques.
   */
  public patchPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { currentPassword?: string; newPassword?: string };
      const result = await this.changePassword.execute({
        userId: req.user!.userId,
        currentPassword: body.currentPassword ?? "",
        newPassword: body.newPassword ?? "",
      });
      if (result.isFailure) {
        res
          .status(UserController.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  };

  private static statusFor(error: AppError): number {
    switch (error.code) {
      case "EMAIL_ALREADY_USED":
        return 409;
      case "INVALID_CREDENTIALS":
        return 401;
      case "USER_NOT_FOUND":
        return 401;
      default:
        return 400; // INVALID_EMAIL, WEAK_PASSWORD, etc.
    }
  }
}
