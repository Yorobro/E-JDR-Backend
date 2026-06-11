import pino, { Logger as PinoLoggerInstance } from "pino";
import { Logger } from "@application/shared/Logger";

/**
 * Adaptateur Pino pour le port `Logger`.
 *
 * Utilise un constructeur privé + factory statique pour s'assurer que l'instance racine
 * est toujours correctement initialisée. `child()` retourne un `PinoLogger` qui encapsule
 * un `pino.child(...)` : tous les champs passés à `child()` sont automatiquement inclus
 * dans chaque ligne de log émise depuis l'instance enfant.
 */
export class PinoLogger implements Logger {
  private constructor(private readonly logger: PinoLoggerInstance) {}

  public static create(level: string): PinoLogger {
    const transport = process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined;

    return new PinoLogger(pino({ level, transport }));
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.logger.info(context ?? {}, message);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(context ?? {}, message);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.logger.error(context ?? {}, message);
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.logger.debug(context ?? {}, message);
  }

  public child(bindings: Record<string, unknown>): Logger {
    return new PinoLogger(this.logger.child(bindings));
  }
}
