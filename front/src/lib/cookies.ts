const TOKEN_KEY = 'pragmatienda_token';
const TOKEN_MAX_AGE_DAYS = 7;

export function setTokenCookie(token: string): void {
  const maxAge = TOKEN_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${import.meta.env.PROD ? '; Secure' : ''}`;
}

export function getTokenCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_KEY}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function removeTokenCookie(): void {
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}
