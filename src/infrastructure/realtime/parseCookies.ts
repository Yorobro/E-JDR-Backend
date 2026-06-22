/**
 * Parse un en-tête HTTP `Cookie` brut (`"a=1; b=2"`) en objet clé→valeur.
 *
 * Nécessaire pour le handshake WebSocket, qui n'a pas le middleware `cookieParser` d'Express :
 * on lit `req.headers.cookie` directement. Les valeurs sont décodées (`decodeURIComponent`).
 */
export function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (header === undefined || header.trim() === "") {
    return result;
  }
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      continue;
    }
    const key = part.slice(0, eq).trim();
    const rawValue = part.slice(eq + 1).trim();
    if (key === "") {
      continue;
    }
    try {
      result[key] = decodeURIComponent(rawValue);
    } catch {
      result[key] = rawValue;
    }
  }
  return result;
}
