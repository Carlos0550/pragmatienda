import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';

export function BillingRequiredScreen() {
  const { setBillingRequired } = useAuth();

  const handleCreateSubscription = async () => {
    try {
      const res = await api.post<{ checkoutUrl?: string }>('/payments/billing/subscriptions');
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch {
      // handled by global error
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="max-w-md w-full text-center space-y-6 animate-fade-in">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Suscripción Requerida</h1>
        <p className="text-muted-foreground">
          Tu suscripción ha vencido o no tienes un plan activo. Para continuar usando la plataforma, activa tu suscripción.
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={handleCreateSubscription} size="lg">
            Activar Suscripción
          </Button>
          <Button variant="outline" onClick={() => setBillingRequired(false)}>
            Volver
          </Button>
        </div>
      </div>
    </div>
  );
}
