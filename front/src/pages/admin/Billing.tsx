import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { sileo } from 'sileo';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import type { Subscription, Plan } from '@/types';
import type { ApiError } from '@/services/api';

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPlanId, setActionPlanId] = useState<string | null>(null);

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

  useEffect(() => { fetchData(); }, []);

  const handleSelectPlan = async (planId: string) => {
    setActionPlanId(planId);
    try {
      if (subscription) {
        await api.patch('/payments/billing/subscriptions/current/plan', { planId });
        sileo.success({ title: 'Plan actualizado' });
        await fetchData();
      } else {
        const res = await api.post<{ data?: { initPoint?: string } }>('/payments/billing/subscriptions', { planId });
        if (res.data?.initPoint) {
          window.location.href = res.data.initPoint;
          return;
        }
        sileo.success({ title: 'Suscripción creada' });
        await fetchData();
      }
    } catch (err) {
      const apiErr = err as ApiError;
      sileo.error({ title: apiErr.message || 'Error al procesar' });
    } finally { setActionPlanId(null); }
  };

  if (loading) return <div className="space-y-4">{[...Array(2)].map((_, i) => <div key={i} className="animate-pulse h-32 rounded-xl bg-muted" />)}</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Suscripción</h2>
        <p className="text-muted-foreground text-sm mt-1">Gestioná tu plan y facturación</p>
      </div>

      {subscription && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-success" />
            <div>
              <h3 className="font-semibold">{subscription.plan.name}</h3>
              <p className="text-sm text-muted-foreground">
                ${subscription.plan.price.toLocaleString()}/{subscription.plan.interval}
                {subscription.currentPeriodEnd && (
                  <> · Vence: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</>
                )}
              </p>
            </div>
          </div>
          {subscription.plan.features && subscription.plan.features.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {subscription.plan.features.map((f, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{f}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {!subscription && (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="text-muted-foreground">No tenés una suscripción activa. Elegí un plan para empezar.</p>
        </div>
      )}

      {plans.length > 0 && (
        <div>
          <h3 className="font-semibold mb-4">{subscription ? 'Cambiar plan' : 'Elegí tu plan'}</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = subscription?.planId === plan.id;
              const isLoading = actionPlanId === plan.id;
              const isFree = plan.price === 0;

              return (
                <div key={plan.id} className={`rounded-xl border p-5 space-y-4 ${isCurrent ? 'border-primary bg-primary/5' : 'bg-card'}`}>
                  <div>
                    <h4 className="font-semibold">{plan.name}</h4>
                    <p className="text-2xl font-bold mt-1">
                      {isFree ? 'Gratis' : `$${plan.price.toLocaleString()}`}
                      {!isFree && <span className="text-sm text-muted-foreground font-normal">/{plan.interval}</span>}
                    </p>
                  </div>
                  {plan.features && plan.features.length > 0 && (
                    <ul className="space-y-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-success shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  {isCurrent ? (
                    <Button disabled variant="outline" className="w-full">Plan actual</Button>
                  ) : (
                    <Button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={!!actionPlanId}
                      variant="outline"
                      className="w-full gap-1"
                    >
                      {isLoading ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Procesando...</>
                      ) : subscription ? (
                        <>Cambiar <ArrowRight className="h-3 w-3" /></>
                      ) : (
                        <>Elegir plan <ArrowRight className="h-3 w-3" /></>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
