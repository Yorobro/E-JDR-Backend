import { NextFunction, Request, RequestHandler, Response } from "express";
import { ITokenProvider } from "@application/features/auth/abstractions/services/ITokenProvider";
import { ACCESS_TOKEN_COOKIE } from "@presentation/http/mappers/AuthHttpMapper";

/**
 * Factory produisant le middleware d'authentification des routes protégées.
 *
 * Lit le jeton d'accès dans le cookie httpOnly `access_token`, le vérifie via le port
 * `ITokenProvider`, puis attache l'identité (`req.user`) pour les handlers suivants.
 * Cookie absent, jeton invalide ou expiré : la chaîne s'arrête sur un
 * `401 { code: "UNAUTHENTICATED" }` — côté client, l'intercepteur tentera un refresh
 * silencieux puis rejouera la requête.
 *
 * @param tokenProvider - Le vérificateur de jetons (injecté depuis `main.ts`).
 * @returns Le middleware Express à monter devant les routes protégées.
 */
export function buildAuthMiddleware(tokenProvider: ITokenProvider): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = (req.cookies as Record<string, string | undefined>)[ACCESS_TOKEN_COOKIE];
    const payload = token === undefined ? null : tokenProvider.verifyAccessToken(token);

    if (payload === null) {
      res.status(401).json({ code: "UNAUTHENTICATED", message: "Authentification requise." });
      return;
    }

    req.user = { userId: payload.userId, email: payload.email };
    next();
  };
}
