/** Sufijos de hostname que se consideran URL de la plataforma (muestra landing en esta misma app). */
const PLATFORM_HOSTNAME_SUFFIXES = ['.code.run'];

export function getLandingUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://pragmatienda.com';
  }

  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;
  const port = window.location.port;

  // En despliegues tipo Northflank (*.code.run), la landing es esta misma URL
  if (PLATFORM_HOSTNAME_SUFFIXES.some((s) => hostname.endsWith(s) || hostname === s.slice(1))) {
    const origin = port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
    return origin;
  }
  if (hostname.endsWith('pragmatienda.com')) {
    return `${protocol}//pragmatienda.com`;
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    const p = port || '3000';
    return `${protocol}//localhost:${p}`;
  }
  return `${protocol}//pragmatienda.com`;
}
