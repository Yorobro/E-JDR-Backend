import { NextFunction, Request, Response } from "express";

/**
 * Middleware de gestion centralisée des erreurs **techniques** non gérées.
 *
 * Les erreurs métier attendues sont traitées en amont via `Result` (réponses 4xx). Ce
 * middleware n'attrape donc que les exceptions imprévues (ex : MySQL injoignable) et les
 * traduit en `500 Internal Server Error`, sans divulguer de détail technique au client.
 *
 * @param error - L'erreur transmise par `next(error)`.
 * @param _req - La requête Express (non utilisée).
 * @param res - La réponse Express.
 * @param _next - Le relais Express (non utilisé, mais requis pour la signature à 4 arguments).
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Journalisation côté serveur pour le diagnostic (le client ne voit rien de technique).
  // eslint-disable-next-line no-console
  console.error("[ERREUR TECHNIQUE NON GÉRÉE]", error);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "Une erreur interne est survenue. Veuillez réessayer plus tard.",
  });
}
