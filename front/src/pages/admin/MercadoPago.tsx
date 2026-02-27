import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle, XCircle, ExternalLink, Package } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import type { Subscription } from '@/types';

export default function MercadoPagoPage() {
  const { tenant } = useTenant();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, sub] = await Promise.all([
          api.get<{ connected: boolean }>('/admin/mercadopago/status').catch(() => ({ connected: false })),
          api.get<Subscription>('/payments/billing/subscriptions/current').catch(() => null),
        ]);
        setConnected(statusRes.connected);
        setSubscription(sub);
      } catch {
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleConnect = async () => {
    if (!tenant?.id || connecting) return;
    setConnecting(true);
    try {
      const res = await api.get<{ authorizationUrl: string }>('/admin/mercadopago/connect-url');
      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
        return;
      }
    } catch {
      setConnecting(false);
      return;
    }
    setConnecting(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mercado Pago</h2>
        <p className="text-muted-foreground text-sm mt-1">Conectá tu cuenta para recibir pagos online</p>
      </div>

      {/* Plan actual del tenant */}
      <div className="rounded-xl border bg-card p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground">Tu plan actual</h3>
            {loading ? (
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            ) : subscription?.plan ? (
              <p className="font-medium">
                {subscription.plan.name}
                {subscription.plan.price > 0 && (
                  <span className="text-muted-foreground font-normal text-sm ml-1">
                    · ${subscription.plan.price.toLocaleString()}/{subscription.plan.interval}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin suscripción activa</p>
            )}
          </div>
        </div>
        {subscription?.currentPeriodEnd && (
          <p className="text-xs text-muted-foreground">
            Próximo vencimiento: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
        {!loading && !subscription && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/billing">Ver planes y suscripción</Link>
          </Button>
        )}
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
            <Button onClick={handleConnect} className="gap-2" disabled={connecting}>
              <ExternalLink className="h-4 w-4" /> {connecting ? 'Conectando...' : 'Conectar Mercado Pago'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
