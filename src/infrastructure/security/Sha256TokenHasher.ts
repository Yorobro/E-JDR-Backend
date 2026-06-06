import { createHash } from "node:crypto";
import { ITokenHasher } from "@application/auth/abstractions/services/ITokenHasher";

/**
 * Implémentation du port `ITokenHasher` basée sur **SHA-256** (module `node:crypto`).
 *
 * Le hachage est déterministe : la même entrée produit toujours la même empreinte, ce qui
 * permet de retrouver un refresh token stocké à partir de son empreinte. SHA-256 sans sel
 * est adapté ici car le refresh token est déjà un JWT à forte entropie (contrairement à un
 * mot de passe, qui exige bcrypt).
 */
export class Sha256TokenHasher implements ITokenHasher {
  /**
   * @inheritdoc
   */
  public hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
