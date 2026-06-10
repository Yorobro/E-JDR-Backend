import { NextFunction, Request, Response } from "express";
import { IGetCurrentUserUseCase } from "@application/auth/abstractions/usecases/IGetCurrentUserUseCase";

/**
 * Controller HTTP des routes utilisateur protégées.
 *
 * Monté derrière le middleware d'authentification : `req.user` est donc toujours
 * renseigné ici. Comme `AuthController`, il ne dépend que des interfaces de use cases.
 */
export class UserController {
  /**
   * @param getCurrentUser - Use case de consultation du profil courant.
   */
  constructor(private readonly getCurrentUser: IGetCurrentUserUseCase) {}

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

      const { userId, email, createdAt } = result.value;
      res.status(200).json({ userId, email, createdAt: createdAt.toISOString() });
    } catch (error) {
      next(error);
    }
  };
}
