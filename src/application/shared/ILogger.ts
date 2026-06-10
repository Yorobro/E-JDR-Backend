/**
 * Port de journalisation structurée.
 *
 * Abstraction que les use cases et services applicatifs utilisent pour émettre des événements
 * métier (connexion réussie, compte verrouillé…) sans dépendre de Pino ou d'une autre lib.
 * L'implémentation concrète vit dans l'infrastructure (`PinoLogger`).
 *
 * `child()` crée un logger enfant pré-rempli avec des champs fixes (ex : `requestId`) :
 * tous les appels sur l'enfant incluront automatiquement ces champs.
 */
export interface ILogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): ILogger;
}

