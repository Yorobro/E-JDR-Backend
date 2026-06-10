import { NextFunction, Request, Response } from "express";
import { ILogger } from "@application/shared/ILogger";

/**
 * Factory produisant le middleware de gestion centralisée des erreurs **techniques** non gérées.
 *
 * Les erreurs métier attendues sont traitées en amont via `Result` (réponses 4xx). Ce
 * middleware n'attrape donc que les exceptions imprévues (ex : MySQL injoignable) et les
 * traduit en `500 Internal Server Error`, sans divulguer de détail technique au client.
 *
 * @param logger - Le logger applicatif (injecté depuis `main.ts`).
 */
export function buildErrorHandler(logger: ILogger) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    logger.error("Erreur technique non gérée", {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (res.headersSent) {
      return;
    }

    res.status(500).json({
      code: "INTERNAL_SERVER_ERROR",
      message: "Une erreur interne est survenue. Veuillez réessayer plus tard.",
    });
  };
}

