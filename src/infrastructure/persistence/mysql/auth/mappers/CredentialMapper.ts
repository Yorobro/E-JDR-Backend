import { Credential } from "@domain/auth/entities/Credential";
import { Email } from "@domain/auth/value-objects/Email";
import { HashedPassword } from "@domain/auth/value-objects/HashedPassword";
import { CredentialRow } from "@infrastructure/persistence/mysql/auth/dao/CredentialDao";

/**
 * Traduit entre la représentation **persistance** (`CredentialRow`) et l'**entité domaine**
 * (`Credential`).
 */
export class CredentialMapper {
  public static toDomain(row: CredentialRow): Credential {
    return Credential.restore({
      id: row.id,
      userId: row.user_id,
      email: Email.create(row.email),
      password: HashedPassword.fromHash(row.password_hash),
      createdAt: new Date(row.created_at),
      failedAttempts: row.failed_attempts,
      lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
    });
  }

  public static toRow(credential: Credential): {
    id: string;
    user_id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    failed_attempts: number;
    locked_until: Date | null;
  } {
    return {
      id: credential.id,
      user_id: credential.userId,
      email: credential.email.value,
      password_hash: credential.password.value,
      created_at: credential.createdAt,
      failed_attempts: credential.failedAttempts,
      locked_until: credential.lockedUntil,
    };
  }
}
