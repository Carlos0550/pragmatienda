export function getLandingUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://pragmatienda.com';
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  if (hostname.endsWith('pragmatienda.com')) {
    return `${protocol}//pragmatienda.com`;
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    const port = window.location.port || '3000';
    return `${protocol}//localhost:${port}`;
  }
  return `${protocol}//pragmatienda.com`;
}
