import bcrypt from "bcrypt";
import { IPasswordHasher } from "@application/features/auth/abstractions/services/IPasswordHasher";

/**
 * Implémentation du port `IPasswordHasher` basée sur **bcrypt**.
 *
 * bcrypt applique un sel aléatoire et un facteur de coût, ce qui rend chaque empreinte
 * unique et la vérification résistante à la force brute. C'est le seul endroit de
 * l'application qui dépend de la librairie bcrypt.
 */
export class BcryptPasswordHasher implements IPasswordHasher {
  /**
   * @param saltRounds - Facteur de coût bcrypt (nombre de tours de sel). Plus il est élevé,
   *                      plus le hachage est lent (donc sûr). 12 est une valeur usuelle.
   */
  constructor(private readonly saltRounds: number = 12) {}

  /**
   * @inheritdoc
   */
  public async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.saltRounds);
  }

  /**
   * @inheritdoc
   */
  public async compare(plainPassword: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash);
  }
}


