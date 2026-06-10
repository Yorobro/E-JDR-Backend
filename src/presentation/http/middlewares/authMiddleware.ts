import { NextFunction, Request, RequestHandler, Response } from "express";
import { ITokenProvider } from "@application/features/auth/abstractions/services/ITokenProvider";
import { ACCESS_TOKEN_COOKIE } from "@presentation/http/mappers/AuthHttpMapper";

/**
 * Informations d'identité attachées à la requête après authentification réussie.
 */
export interface AuthenticatedUser {
  /** Identifiant de l'utilisateur authentifié. */
  readonly userId: string;
  /** Adresse e-mail de l'utilisateur authentifié. */
  readonly email: string;
}

/**
 * Extension du type `Request` d'Express pour transporter l'utilisateur authentifié.
 */
export interface AuthenticatedRequest extends Request {
  /** L'utilisateur authentifié, présent uniquement après passage du `authMiddleware`. */
  user?: AuthenticatedUser;
}

/**
 * Construit le middleware d'authentification qui protège les routes nécessitant une session.
 *
 * Il lit l'access token depuis le cookie httpOnly, le vérifie via le `ITokenProvider`, et
 * attache l'utilisateur à la requête. En cas d'absence ou d'invalidité, il répond `401`.
 *
 * (Fourni pour les futures routes protégées ; les routes d'auth elles-mêmes sont publiques.)
 *
 * @param tokenProvider - Port de vérification des jetons d'accès.
 * @returns Un middleware Express prêt à être monté sur des routes protégées.
 */
export function buildAuthMiddleware(tokenProvider: ITokenProvider): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = (req.cookies as Record<string, string | undefined>)[ACCESS_TOKEN_COOKIE];

    if (token === undefined) {
      res.status(401).json({ code: "UNAUTHENTICATED", message: "Authentification requise." });
      return;
    }

    const payload = tokenProvider.verifyAccessToken(token);

    if (payload === null) {
      res.status(401).json({ code: "UNAUTHENTICATED", message: "Session invalide ou expirée." });
      return;
    }

    req.user = { userId: payload.userId, email: payload.email };
    next();
  };
}


