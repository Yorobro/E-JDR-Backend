import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Représentation **brute** d'une ligne de la table `credentials`, telle que renvoyée par MySQL.
 *
 * Les noms de colonnes (snake_case) reflètent exactement le schéma SQL. Le mapping vers
 * l'entité domaine est effectué ailleurs (par le `CredentialMapper`), pas par le DAO.
 */
export interface CredentialRow extends RowDataPacket {
  /** Identifiant de l'enregistrement (colonne `id`). */
  id: string;
  /** Identifiant de l'utilisateur métier rattaché (colonne `user_id`). */
  user_id: string;
  /** Adresse e-mail (colonne `email`). */
  email: string;
  /** Empreinte du mot de passe (colonne `password_hash`). */
  password_hash: string;
  /** Date de création (colonne `created_at`). */
  created_at: Date;
}

/**
 * DAO de la table `credentials` : **SQL pur**, une seule table, renvoie des lignes brutes.
 *
 * Le DAO ne connaît rien du domaine ni du mapping : il exécute des requêtes sur sa table et
 * retourne les `CredentialRow` correspondantes. L'assemblage vers les entités est la
 * responsabilité du repository.
 */
export class CredentialDao {
  /**
   * @param pool - Le pool de connexions MySQL utilisé pour exécuter les requêtes.
   */
  constructor(private readonly pool: Pool) {}

  /**
   * Insère une nouvelle ligne dans la table `credentials`.
   *
   * @param row - Les valeurs de colonnes à insérer.
   * @returns Une promesse résolue une fois l'insertion effectuée.
   */
  public async insert(row: {
    id: string;
    user_id: string;
    email: string;
    password_hash: string;
    created_at: Date;
  }): Promise<void> {
    await this.pool.execute(
      `INSERT INTO credentials (id, user_id, email, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [row.id, row.user_id, row.email, row.password_hash, row.created_at],
    );
  }

  /**
   * Récupère une ligne `credentials` par son adresse e-mail.
   *
   * @param email - L'e-mail recherché (déjà normalisé).
   * @returns La ligne correspondante, ou `null` si aucune.
   */
  public async findByEmail(email: string): Promise<CredentialRow | null> {
    const [rows] = await this.pool.execute<CredentialRow[]>(
      `SELECT id, user_id, email, password_hash, created_at
       FROM credentials WHERE email = ? LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  }

  /**
   * Indique si une ligne `credentials` existe pour une adresse e-mail donnée.
   *
   * @param email - L'e-mail à tester (déjà normalisé).
   * @returns `true` si une ligne existe, `false` sinon.
   */
  public async existsByEmail(email: string): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT 1 FROM credentials WHERE email = ? LIMIT 1",
      [email],
    );
    return rows.length > 0;
  }
}
