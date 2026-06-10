declare namespace Express {
  interface Request {
    user?: {
      readonly userId: string;
      readonly email: string;
    };
    /** Identifiant de corrélation attaché par `requestIdMiddleware` (UUID v4 ou X-Request-ID entrant). */
    requestId: string;
  }
}


