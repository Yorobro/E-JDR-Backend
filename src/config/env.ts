import dotenv from "dotenv";

dotenv.config();

/**
 * Configuration applicative typée, dérivée des variables d'environnement.
 *
 * Centralise et valide la lecture de l'environnement en un seul endroit, afin que le reste
 * du code manipule une configuration sûre et typée plutôt que `process.env` directement.
 */
export interface AppConfig {
  /** Port d'écoute du serveur HTTP. */
  readonly port: number;
  /** Indique si l'application tourne en mode production (impacte les cookies `secure`). */
  readonly isProduction: boolean;
  /** Configuration de connexion à MySQL. */
  readonly db: {
    readonly host: string;
    readonly port: number;
    readonly user: string;
    readonly password: string;
    readonly database?: string;
  };
  /** Configuration des jetons JWT. */
  readonly jwt: {
    readonly accessSecret: string;
    readonly refreshSecret: string;
    readonly accessExpiresIn: string;
    readonly refreshExpiresIn: string;
  };
}

/**
 * Lit une variable d'environnement obligatoire.
 *
 * @param key - Le nom de la variable d'environnement.
 * @returns La valeur de la variable.
 * @throws {Error} Si la variable est absente ou vide (erreur de configuration au démarrage).
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Variable d'environnement manquante : ${key}`);
  }
  return value;
}

/**
 * Lit une variable d'environnement optionnelle avec valeur par défaut.
 *
 * @param key - Le nom de la variable d'environnement.
 * @param fallback - La valeur par défaut si la variable est absente.
 * @returns La valeur lue ou la valeur par défaut.
 */
function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value.trim() === "" ? fallback : value;
}

/**
 * Construit et valide la configuration applicative à partir de l'environnement.
 *
 * @returns La configuration typée, prête à être injectée dans le composition root.
 * @throws {Error} Si une variable obligatoire est manquante.
 */
export function loadConfig(): AppConfig {
  return {
    port: Number(optionalEnv("PORT", "3000")),
    isProduction: optionalEnv("NODE_ENV", "development") === "production",
    db: {
      host: requireEnv("DB_HOST"),
      port: Number(optionalEnv("DB_PORT", "3306")),
      user: requireEnv("DB_USER"),
      password: requireEnv("DB_PASSWORD"),
      database: optionalEnv("DB_NAME", "") || undefined
    },
    jwt: {
      accessSecret: requireEnv("JWT_ACCESS_SECRET"),
      refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
      accessExpiresIn: optionalEnv("JWT_ACCESS_EXPIRES_IN", "15m"),
      refreshExpiresIn: optionalEnv("JWT_REFRESH_EXPIRES_IN", "7d"),
    },
  };
}
