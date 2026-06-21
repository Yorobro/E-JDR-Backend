/** Type de canal temps réel reconnu. */
export type ChannelKind = "user" | "group" | "sheet";

/** Canal des événements personnels d'un utilisateur (abonnement automatique). */
export function userChannel(userId: string): string {
  return `user:${userId}`;
}

/** Canal des événements d'un groupe (membres du groupe). */
export function groupChannel(groupId: string): string {
  return `group:${groupId}`;
}

/** Canal des événements d'une fiche ouverte (abonnement éphémère). */
export function sheetChannel(sheetId: string): string {
  return `sheet:${sheetId}`;
}

/**
 * Décompose un nom de canal en `{ kind, id }`, ou renvoie `null` si le type est inconnu
 * ou l'identifiant absent.
 */
export function parseChannel(channel: string): { kind: ChannelKind; id: string } | null {
  const separator = channel.indexOf(":");
  if (separator <= 0) {
    return null;
  }
  const prefix = channel.slice(0, separator);
  const id = channel.slice(separator + 1);
  if (id === "") {
    return null;
  }
  if (prefix === "user" || prefix === "group" || prefix === "sheet") {
    return { kind: prefix, id };
  }
  return null;
}
