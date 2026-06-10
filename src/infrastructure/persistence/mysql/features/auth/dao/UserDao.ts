import { RowDataPacket } from "mysql2/promise";
import { SqlExecutor } from "@infrastructure/persistence/mysql/SqlExecutor";

/**
 * Représentation **brute** d'une ligne de la table `users`, telle que renvoyée par MySQL.
 *
 * Ne porte que l'identité métier : les données d'authentification vivent dans `credentials`.
 * Le mapping vers l'entité domaine est effectué par le `UserMapper`, pas par le DAO.
 */
export interface UserRow extends RowDataPacket {
  /** Identifiant (colonne `id`). */
  id: string;
  /** Date de création (colonne `created_at`). */
  created_at: Date;
}

/**
 * DAO de la table `users` : **SQL pur**, une seule table, renvoie des lignes brutes.
 *
 * Le DAO ne connaît rien du domaine ni du mapping : il exécute des requêtes sur sa table et
 * retourne les `UserRow` correspondantes.
 */
export class UserDao {
  constructor(private readonly executor: SqlExecutor) {}

  /**
   * Insère une nouvelle ligne dans la table `users`.
   *
   * @param row - Les valeurs de colonnes à insérer.
   * @returns Une promesse résolue une fois l'insertion effectuée.
   */
  public async insert(row: { id: string; created_at: Date }): Promise<void> {
    await this.executor.execute("INSERT INTO users (id, created_at) VALUES (?, ?)", [
      row.id,
      row.created_at,
    ]);
  }

  /**
   * Récupère une ligne `users` par son identifiant.
   *
   * @param id - L'identifiant recherché.
   * @returns La ligne correspondante, ou `null` si aucune.
   */
  public async findById(id: string): Promise<UserRow | null> {
    const [rows] = await this.executor.execute<UserRow[]>(
      "SELECT id, created_at FROM users WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] ?? null;
  }
}


