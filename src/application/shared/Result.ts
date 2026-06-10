/**
 * Conteneur générique représentant l'issue d'une opération : soit un **succès**
 * portant une valeur de type `T`, soit un **échec** portant une erreur de type `E`.
 *
 * Ce type est utilisé pour les **erreurs métier attendues** (e-mail déjà pris,
 * identifiants invalides...), par opposition aux exceptions réservées aux erreurs
 * techniques imprévues. L'erreur fait ainsi partie de la signature de retour : le
 * compilateur force l'appelant à traiter le cas d'échec.
 *
 * @typeParam T - Type de la valeur en cas de succès.
 * @typeParam E - Type de l'erreur en cas d'échec.
 */
export class Result<T, E> {
  /**
   * Constructeur privé : on passe par les fabriques {@link Result.success}
   * ou {@link Result.failure} pour garantir la cohérence de l'état interne.
   *
   * @param _isSuccess - Indique si le résultat est un succès.
   * @param _value - La valeur de succès (présente uniquement si succès).
   * @param _error - L'erreur d'échec (présente uniquement si échec).
   */
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}

  /**
   * Crée un résultat de **succès**.
   *
   * @param value - La valeur produite par l'opération.
   * @returns Un `Result` en état de succès.
   */
  public static success<T, E>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  /**
   * Crée un résultat d'**échec**.
   *
   * @param error - L'erreur métier décrivant l'échec.
   * @returns Un `Result` en état d'échec.
   */
  public static failure<T, E>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  /** @returns `true` si le résultat représente un succès. */
  public get isSuccess(): boolean {
    return this._isSuccess;
  }

  /** @returns `true` si le résultat représente un échec. */
  public get isFailure(): boolean {
    return !this._isSuccess;
  }

  /**
   * Récupère la valeur de succès.
   *
   * @returns La valeur produite par l'opération.
   * @throws {Error} Si le résultat est un échec (appel incohérent côté programmeur).
   */
  public get value(): T {
    if (!this._isSuccess) {
      throw new Error("Tentative de lecture de `value` sur un Result en échec.");
    }
    return this._value as T;
  }

  /**
   * Récupère l'erreur d'échec.
   *
   * @returns L'erreur métier portée par le résultat.
   * @throws {Error} Si le résultat est un succès (appel incohérent côté programmeur).
   */
  public get error(): E {
    if (this._isSuccess) {
      throw new Error("Tentative de lecture de `error` sur un Result en succès.");
    }
    return this._error as E;
  }
}


