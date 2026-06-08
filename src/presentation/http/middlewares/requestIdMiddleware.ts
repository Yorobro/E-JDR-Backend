import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

/**
 * Attache un identifiant de corrélation à chaque requête HTTP entrante.
 *
 * Si le header `X-Request-ID` est déjà présent (ex : proxy en amont), sa valeur est
 * réutilisée telle quelle — cela permet de tracer une requête de bout en bout à travers
 * plusieurs services. Sinon un UUID v4 est généré localement. L'identifiant est :
 *   - écrit sur `req.requestId` (accessible dans les middlewares et le controller suivants)
 *   - renvoyé dans le header `X-Request-ID` de la réponse (utile pour le débogage côté client)
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}
