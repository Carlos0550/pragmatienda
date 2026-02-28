const TOKEN_KEY = 'pragmatienda_token';
const TOKEN_MAX_AGE_DAYS = 7;

export function setTokenCookie(token: string): void {
  if (typeof document === 'undefined') return;
  const maxAge = TOKEN_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${import.meta.env.PROD ? '; Secure' : ''}`;
}

export function getTokenCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_KEY}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function removeTokenCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}

export function getTokenFromCookieHeader(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const rawPart of parts) {
    const [rawKey, ...rawValueParts] = rawPart.trim().split('=');
    if (rawKey !== TOKEN_KEY) continue;
    const rawValue = rawValueParts.join('=');
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue || null;
    }
  }
  return null;
}
