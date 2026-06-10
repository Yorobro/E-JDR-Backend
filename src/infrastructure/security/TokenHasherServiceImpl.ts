import { createHash } from "node:crypto";
import { TokenHasherService } from "@application/features/auth/abstractions/services/TokenHasherService";

/**
 * Implémentation du port `TokenHasherService` basée sur **SHA-256** (module `node:crypto`).
 *
 * Le hachage est déterministe : la même entrée produit toujours la même empreinte, ce qui
 * permet de retrouver un refresh token stocké à partir de son empreinte. SHA-256 sans sel
 * est adapté ici car le refresh token est déjà un JWT à forte entropie (contrairement à un
 * mot de passe, qui exige bcrypt).
 */
export class TokenHasherServiceImpl implements TokenHasherService {
  /**
   * @inheritdoc
   */
  public hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
