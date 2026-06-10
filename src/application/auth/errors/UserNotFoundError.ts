import { AppError } from "@application/errors/AppError";

/**
 * Erreur applicative renvoyée lorsqu'un utilisateur référencé par un jeton valide
 * n'existe plus en base (ex : compte supprimé après l'émission du jeton).
 *
 * Traduite en `401 Unauthorized` par la couche présentation : du point de vue du
 * client, la session n'est plus valide et il doit se déconnecter.
 */
export class UserNotFoundError extends AppError {
  constructor() {
    super("USER_NOT_FOUND", "Utilisateur introuvable.");
  }
}
