import { useEffect, useState } from 'react';

const REDIRECT_SECONDS = 5;

function getLandingUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://pragmatienda.com' ;
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

export function StoreNotFoundFallback() {
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);
  const landingUrl = getLandingUrl();

  useEffect(() => {
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(t);
          window.location.href = landingUrl;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [landingUrl]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-2xl font-bold">Esta tienda no existe</h1>
        <p className="text-muted-foreground">
          La dirección a la que intentás acceder no corresponde a ninguna tienda. Serás redirigido a PragmaTienda en{' '}
          <span className="font-semibold tabular-nums">{seconds}</span> segundos.
        </p>
        <a
          href={landingUrl}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground px-4 py-2 hover:bg-primary/90"
        >
          Ir a PragmaTienda ahora
        </a>
      </div>
    </div>
  );
}
