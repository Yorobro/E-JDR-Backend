import { NextFunction, Request, Response } from "express";
import { ILogger } from "@application/shared/ILogger";

/**
 * Middleware de journalisation des accès HTTP.
 *
 * Enregistre chaque requête **à sa clôture** (événement `res.on('finish')`) pour inclure
 * le code de statut et la durée réelle. Le log est émis sur le logger enfant portant le
 * `requestId` de la requête, ce qui corrèle automatiquement la ligne d'accès avec tous
 * les autres logs émis pendant le traitement de la même requête.
 *
 * Le corps de la requête n'est jamais loggé (données potentiellement sensibles : mots de
 * passe, tokens).
 *
 * @param logger - Le logger racine de l'application (injecté depuis `main.ts`).
 */
export function buildHttpLoggerMiddleware(logger: ILogger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const requestLogger = logger.child({ requestId: req.requestId });

    res.on("finish", () => {
      requestLogger.info("HTTP request", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });

    next();
  };
}


