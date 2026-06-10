import { RowDataPacket } from "mysql2/promise";
import { SqlExecutor } from "@infrastructure/persistence/mysql/SqlExecutor";

/**
 * Représentation **brute** d'une ligne de la table `credentials`, telle que renvoyée par MySQL.
 */
export interface CredentialRow extends RowDataPacket {
  id: string;
  user_id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  failed_attempts: number;
  locked_until: Date | null;
}

/**
 * DAO de la table `credentials` : **SQL pur**, une seule table, renvoie des lignes brutes.
 */
export class CredentialDao {
  constructor(private readonly executor: SqlExecutor) {}

  public async insert(row: {
    id: string;
    user_id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    failed_attempts: number;
    locked_until: Date | null;
  }): Promise<void> {
    await this.executor.execute(
      `INSERT INTO credentials (id, user_id, email, password_hash, created_at, failed_attempts, locked_until)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.user_id,
        row.email,
        row.password_hash,
        row.created_at,
        row.failed_attempts,
        row.locked_until,
      ],
    );
  }

  public async findByEmail(email: string): Promise<CredentialRow | null> {
    const [rows] = await this.executor.execute<CredentialRow[]>(
      `SELECT id, user_id, email, password_hash, created_at, failed_attempts, locked_until
       FROM credentials WHERE email = ? LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  }

  public async existsByEmail(email: string): Promise<boolean> {
    const [rows] = await this.executor.execute<RowDataPacket[]>(
      "SELECT 1 FROM credentials WHERE email = ? LIMIT 1",
      [email],
    );
    return rows.length > 0;
  }

  public async update(
    id: string,
    data: { failed_attempts: number; locked_until: Date | null },
  ): Promise<void> {
    await this.executor.execute(
      "UPDATE credentials SET failed_attempts = ?, locked_until = ? WHERE id = ?",
      [data.failed_attempts, data.locked_until, id],
    );
  }
}


