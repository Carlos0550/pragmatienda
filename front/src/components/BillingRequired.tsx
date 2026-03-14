import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export function BillingRequiredScreen() {
  const { setBillingRequired } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="max-w-md w-full text-center space-y-6 animate-fade-in">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Revisá tu suscripción</h1>
        <p className="text-muted-foreground">
          Tu suscripción necesita atención para seguir usando funciones administrativas de la plataforma. Revisá tu estado de facturación y actualizá tu plan si hace falta.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link to="/admin/billing" onClick={() => setBillingRequired(false)}>
              Ir a facturación
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setBillingRequired(false)}>
            Volver
          </Button>
        </div>
      </div>
    </div>
  );
}
