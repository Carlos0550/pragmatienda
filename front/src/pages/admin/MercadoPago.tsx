import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';

export default function MercadoPagoPage() {
  const { tenant } = useTenant();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check MP connection status
    api.get<{ connected: boolean }>('/admin/mercadopago/status')
      .then((res) => setConnected(res.connected))
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = () => {
    if (!tenant?.id) return;
    window.location.href = `${import.meta.env.VITE_API_BASE_URL || '/api'}/payments/mercadopago/connect/${tenant.id}`;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mercado Pago</h2>
        <p className="text-muted-foreground text-sm mt-1">Conectá tu cuenta para recibir pagos online</p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-info" />
          </div>
          <div>
            <h3 className="font-semibold">Integración Mercado Pago</h3>
            <p className="text-sm text-muted-foreground">Aceptá pagos con tarjeta, transferencia y más</p>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse h-12 rounded-lg bg-muted" />
        ) : connected ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-sm font-medium">Cuenta conectada correctamente</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">Cuenta no conectada</span>
            </div>
            <Button onClick={handleConnect} className="gap-2">
              <ExternalLink className="h-4 w-4" /> Conectar Mercado Pago
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
