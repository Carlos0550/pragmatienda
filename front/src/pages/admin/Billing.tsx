import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { sileo } from 'sileo';
import { CheckCircle, ArrowRight } from 'lucide-react';
import type { Subscription, Plan } from '@/types';
import type { ApiError } from '@/services/api';

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sub, pls] = await Promise.all([
          api.get<Subscription>('/payments/billing/subscriptions/current').catch(() => null),
          api.get<Plan[]>('/payments/billing/plans').catch(() => []),
        ]);
        setSubscription(sub);
        setPlans(Array.isArray(pls) ? pls.filter((p) => p.active) : []);
      } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const handleCreateSubscription = async () => {
    try {
      const res = await api.post<{ checkoutUrl?: string }>('/payments/billing/subscriptions');
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
    } catch { sileo.error({ title: 'Error al crear suscripción' }); }
  };

  const handleChangePlan = async (planId: string) => {
    setChangingPlan(true);
    try {
      await api.patch('/payments/billing/subscriptions/current/plan', { planId });
      sileo.success({ title: 'Plan actualizado' });
      const sub = await api.get<Subscription>('/payments/billing/subscriptions/current').catch(() => null);
      setSubscription(sub);
    } catch (err) {
      const apiErr = err as ApiError;
      sileo.error({ title: apiErr.message || 'Error al cambiar plan' });
    } finally { setChangingPlan(false); }
  };

  if (loading) return <div className="space-y-4">{[...Array(2)].map((_, i) => <div key={i} className="animate-pulse h-32 rounded-xl bg-muted" />)}</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Suscripción</h2>
        <p className="text-muted-foreground text-sm mt-1">Gestioná tu plan y facturación</p>
      </div>

      {subscription ? (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-success" />
            <div>
              <h3 className="font-semibold">{subscription.plan.name}</h3>
              <p className="text-sm text-muted-foreground">
                ${subscription.plan.price}/{subscription.plan.interval} · Vence: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {subscription.plan.features?.map((f, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{f}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-6 text-center space-y-4">
          <p className="text-muted-foreground">No tenés una suscripción activa.</p>
          <Button onClick={handleCreateSubscription}>Activar Suscripción</Button>
        </div>
      )}

      {plans.length > 0 && (
        <div>
          <h3 className="font-semibold mb-4">Planes Disponibles</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div key={plan.id} className={`rounded-xl border p-5 space-y-4 ${subscription?.planId === plan.id ? 'border-primary bg-primary/5' : 'bg-card'}`}>
                <div>
                  <h4 className="font-semibold">{plan.name}</h4>
                  <p className="text-2xl font-bold mt-1">${plan.price}<span className="text-sm text-muted-foreground font-normal">/{plan.interval}</span></p>
                </div>
                <ul className="space-y-2">
                  {plan.features?.map((f, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                {subscription?.planId === plan.id ? (
                  <Button disabled variant="outline" className="w-full">Plan actual</Button>
                ) : (
                  <Button onClick={() => handleChangePlan(plan.id)} disabled={changingPlan} variant="outline" className="w-full gap-1">
                    Cambiar <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
