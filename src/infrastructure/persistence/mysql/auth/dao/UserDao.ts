import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Représentation **brute** d'une ligne de la table `users`, telle que renvoyée par MySQL.
 *
 * Les noms de colonnes (snake_case) reflètent exactement le schéma SQL. Le mapping vers
 * l'entité domaine est effectué ailleurs (par le `UserMapper`), pas par le DAO.
 */
export interface UserRow extends RowDataPacket {
  /** Identifiant (colonne `id`). */
  id: string;
  /** Adresse e-mail (colonne `email`). */
  email: string;
  /** Empreinte du mot de passe (colonne `password_hash`). */
  password_hash: string;
  /** Date de création (colonne `created_at`). */
  created_at: Date;
}

/**
 * DAO de la table `users` : **SQL pur**, une seule table, renvoie des lignes brutes.
 *
 * Le DAO ne connaît rien du domaine ni du mapping : il se contente d'exécuter des requêtes
 * sur sa table et de retourner les `UserRow` correspondantes. L'assemblage et la traduction
 * vers les entités sont la responsabilité du repository.
 */
export class UserDao {
  /**
   * @param pool - Le pool de connexions MySQL utilisé pour exécuter les requêtes.
   */
  constructor(private readonly pool: Pool) {}

  /**
   * Insère une nouvelle ligne dans la table `users`.
   *
   * @param row - Les valeurs de colonnes à insérer.
   * @returns Une promesse résolue une fois l'insertion effectuée.
   */
  public async insert(row: {
    id: string;
    email: string;
    password_hash: string;
    created_at: Date;
  }): Promise<void> {
    await this.pool.execute(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      [row.id, row.email, row.password_hash, row.created_at],
    );
  }

  /**
   * Récupère une ligne `users` par son adresse e-mail.
   *
   * @param email - L'e-mail recherché (déjà normalisé).
   * @returns La ligne correspondante, ou `null` si aucune.
   */
  public async findByEmail(email: string): Promise<UserRow | null> {
    const [rows] = await this.pool.execute<UserRow[]>(
      "SELECT id, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    return rows[0] ?? null;
  }

  /**
   * Indique si une ligne `users` existe pour une adresse e-mail donnée.
   *
   * @param email - L'e-mail à tester (déjà normalisé).
   * @returns `true` si une ligne existe, `false` sinon.
   */
  public async existsByEmail(email: string): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT 1 FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    return rows.length > 0;
  }
}
