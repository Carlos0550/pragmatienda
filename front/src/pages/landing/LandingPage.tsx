import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Zap, Shield } from 'lucide-react';
import { capitalizeName } from '@/lib/utils';

export interface PublicPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  description?: string;
  trialDays: number;
}

export function LandingPage() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PublicPlan[]>('/public/plans')
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = (p: PublicPlan) => {
    if (p.price === 0) return 'Gratis';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: p.currency || 'ARS',
      minimumFractionDigits: 0,
    }).format(p.price);
  };

  const intervalLabel = (interval: string) => {
    const i = (interval || 'month').toLowerCase();
    if (i === 'month') return '/mes';
    if (i === 'year') return '/año';
    return `/${interval}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center px-4">
          <span className="text-xl font-bold tracking-tight text-primary">PragmaTienda</span>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4 py-20 lg:py-28">
            <div className="mx-auto max-w-3xl text-center space-y-6">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Tu tienda online en minutos
              </h1>
              <p className="text-lg text-muted-foreground">
                Crea tu catálogo, gestiona pedidos y cobra con Mercado Pago. Sin conocimientos técnicos.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-4">
                <Link to="/admin/login">
                  <Button size="lg" className="gap-2">
                    <Store className="h-5 w-5" />
                    Crear mi tienda
                  </Button>
                </Link>
                <a
                  href="https://pragmatienda.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-secondary px-6 py-3 hover:bg-secondary/80"
                >
                  Ver demo
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="grid gap-8 md:grid-cols-3 text-center">
            <div className="space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Rápido de configurar</h3>
              <p className="text-sm text-muted-foreground">
                Sube productos, elige tu plan y abre tu tienda en el mismo día.
              </p>
            </div>
            <div className="space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Tu propia URL</h3>
              <p className="text-sm text-muted-foreground">
                mitienda.pragmatienda.com para que tus clientes te encuentren fácil.
              </p>
            </div>
            <div className="space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Pagos seguros</h3>
              <p className="text-sm text-muted-foreground">
                Integrado con Mercado Pago. Cobrás y vos te quedás con el control.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t bg-secondary/20 py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-10">Planes para tu negocio</h2>
            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader><div className="h-6 bg-muted rounded" /></CardHeader>
                    <CardContent><div className="h-20 bg-muted rounded" /></CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                {plans.map((plan) => (
                  <Card key={plan.id} className="flex flex-col">
                    <CardHeader>
                      <CardTitle>{capitalizeName(plan.name)}</CardTitle>
                      <CardDescription>{plan.description || null}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="text-2xl font-bold">
                        {formatPrice(plan)}
                        <span className="text-sm font-normal text-muted-foreground">
                          {plan.price > 0 ? intervalLabel(plan.interval) : ''}
                        </span>
                      </div>
                      {plan.trialDays > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {plan.trialDays} días de prueba
                        </p>
                      )}
                      <Link to="/admin/login" className="mt-6 block">
                        <Button variant="outline" className="w-full">
                          Empezar
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} PragmaTienda. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
