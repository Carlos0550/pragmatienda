import { Loader2 } from 'lucide-react';

export function StorefrontLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="mt-4 text-sm text-muted-foreground">Cargando tu tienda...</p>
    </div>
  );
}
