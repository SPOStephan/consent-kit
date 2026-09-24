/**
 * Prüfung der Anmeldung über Cloudflare Access.
 *
 * Cloudflare Access schickt bei jedem angemeldeten Aufruf ein signiertes Token
 * (JWT) im Header `Cf-Access-Jwt-Assertion` bzw. im Cookie `CF_Authorization`.
 * Wir prüfen Signatur, Aussteller, Zielgruppe (AUD) und Ablaufzeit selbst – so
 * bleibt die Admin-Oberfläche auch dann gesperrt, wenn Access versehentlich
 * falsch eingerichtet ist.
 */

interface Jwk extends JsonWebKey {
  kid?: string;
}

interface JwtPayload {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  email?: string;
  sub?: string;
}

type FetchLike = (url: string) => Promise<Response>;

const keyCache = new Map<string, { keys: Jwk[]; expires: number }>();

/** "meinteam", "meinteam.cloudflareaccess.com" oder "https://meinteam.cloudflareaccess.com/" → "https://meinteam.cloudflareaccess.com" */
export function normalizeTeamDomain(team: string): string {
  let host = team.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!host.includes('.')) host += '.cloudflareaccess.com';
  return `https://${host}`;
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function decodeJson<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(part))) as T;
}

async function getKeys(issuer: string, fetchImpl: FetchLike, forceRefresh = false): Promise<Jwk[]> {
  const cached = keyCache.get(issuer);
  if (cached && cached.expires > Date.now() && !forceRefresh) return cached.keys;
  const response = await fetchImpl(`${issuer}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access-Schlüssel nicht abrufbar (HTTP ${response.status})`);
  const data = (await response.json()) as { keys?: Jwk[] };
  const keys = data.keys ?? [];
  keyCache.set(issuer, { keys, expires: Date.now() + 10 * 60 * 1000 });
  return keys;
}

/** Nur für Tests. */
export function clearAccessKeyCache(): void {
  keyCache.clear();
}

/**
 * Prüft ein Cloudflare-Access-Token. Gibt die E-Mail-Adresse (bzw. `sub`) des
 * angemeldeten Nutzers zurück – oder null, wenn das Token ungültig ist.
 */
export async function verifyAccessJwt(
  token: string,
  teamDomain: string,
  audience: string,
  fetchImpl: FetchLike = (url) => fetch(url),
  now = Date.now(),
): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let payload: JwtPayload;
  try {
    header = decodeJson(headerPart);
    payload = decodeJson(payloadPart);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  const issuer = normalizeTeamDomain(teamDomain);
  let keys = await getKeys(issuer, fetchImpl);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    // Cloudflare rotiert die Schlüssel regelmäßig.
    keys = await getKeys(issuer, fetchImpl, true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return null;

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlDecode(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) return null;

  const seconds = Math.floor(now / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) return null;
  if (payload.iss !== issuer) return null;
  if (typeof payload.exp !== 'number' || payload.exp < seconds) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > seconds + 60) return null;
  return payload.email ?? payload.sub ?? 'unbekannt';
}

/** Token aus Header oder Cookie lesen. */
export function accessTokenFrom(request: Request): string | null {
  const header = request.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookie = request.headers.get('Cookie') ?? '';
  const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]!) : null;
}
