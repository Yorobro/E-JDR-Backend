/**
 * Résolution du nom de la base de données applicative.
 *
 * Certains environnements d'exécution (ex. Vertex / Cloud Run) injectent un `DB_NAME`
 * par défaut inadapté — typiquement `test` — qui ne correspond pas à la base de l'application
 * et provoque `ER_BAD_DB_ERROR: Unknown database 'test'` au lancement des migrations.
 *
 * On centralise donc ici la règle : la base applicative est **toujours** `e_jdr`, sauf si un
 * `DB_NAME` explicite et non réservé est fourni. Les valeurs vides ou réservées (`test`) sont
 * ignorées au profit du défaut.
 */

/** Nom de base par défaut de l'application. */
export const DEFAULT_DB_NAME = "e_jdr";

/**
 * Noms de base réservés/non valides qu'on refuse d'utiliser comme base applicative,
 * même s'ils sont passés via l'environnement (cas du `test` injecté par la plateforme).
 */
const RESERVED_DB_NAMES = new Set([
  "test",
  "mysql",
  "information_schema",
  "performance_schema",
  "sys",
]);

/**
 * Détermine le nom de base à utiliser à partir d'une valeur d'environnement brute.
 *
 * @param raw - Valeur de `DB_NAME` lue depuis l'environnement (peut être `undefined`).
 * @returns Le nom explicite s'il est valide, sinon {@link DEFAULT_DB_NAME}.
 */
export function resolveDbName(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value || RESERVED_DB_NAMES.has(value.toLowerCase())) {
    return DEFAULT_DB_NAME;
  }
  return value;
}
