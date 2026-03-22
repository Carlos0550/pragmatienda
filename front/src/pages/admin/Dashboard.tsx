import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  Package,
  AlertCircle,
  AlertOctagon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { http } from '@/services/http';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MonthPicker } from '@/components/ui/month-picker';
import { capitalizeName } from '@/lib/utils';
import type { DashboardStats } from '@/types';

type ViewMode = { type: 'days'; value: 7 | 30 } | { type: 'month'; date: Date };

export default function AdminDashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>({ type: 'days', value: 7 });

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', viewMode],
    queryFn: async () => {
      let response;
      if (viewMode.type === 'days') {
        response = await http.dashboard.getStats(viewMode.value);
      } else {
        const year = viewMode.date.getFullYear();
        const month = viewMode.date.getMonth() + 1; // 1-based
        response = await http.dashboard.getStatsByMonth(year, month);
      }
      return response;
    },
  });

  const kpis = stats?.kpis;
  const revenueChart = stats?.revenueChart || [];
  const stockAlerts = stats?.stockAlerts || [];
  const recentOrders = stats?.recentOrders || [];
  const topProducts = stats?.topProducts || [];

  // Formato de moneda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calcular porcentaje de cambio
  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const revenueChange = kpis ? getChangePercent(kpis.revenue, kpis.revenuePrev) : 0;
  const ordersChange = kpis ? getChangePercent(kpis.orders, kpis.ordersPrev) : 0;

  // Formatear datos del gráfico
  const chartData = revenueChart.map((item) => {
    const date = new Date(item.date);
    return {
      date: format(date, 'dd', { locale: es }),
      dayName: format(date, 'EEE', { locale: es }),
      total: item.total,
      fullDate: format(date, 'dd/MM'),
    };
  });

  // Determinar título del gráfico con rango de fechas
  const getChartTitle = () => {
    if (viewMode.type === 'days') {
      if (chartData.length > 0) {
        const firstDate = chartData[0].fullDate;
        const lastDate = chartData[chartData.length - 1].fullDate;
        return `Ingresos — Últimos ${viewMode.value} días (${firstDate} - ${lastDate})`;
      }
      return `Ingresos — Últimos ${viewMode.value} días`;
    } else {
      return `Ingresos — ${format(viewMode.date, 'MMMM yyyy', { locale: es })}`;
    }
  };

  // Status badges para pedidos
  const getOrderStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      PENDING: { variant: 'secondary', label: 'Pendiente' },
      PROCESSED: { variant: 'default', label: 'Procesado' },
      PAID: { variant: 'outline', label: 'Pagado' },
      SHIPPED: { variant: 'default', label: 'Enviado' },
      DELIVERED: { variant: 'outline', label: 'Entregado' },
      COMPLETED: { variant: 'outline', label: 'Completado' },
      CANCELLED: { variant: 'destructive', label: 'Cancelado' },
    };
    
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Status badges para stock
  const getStockStatusConfig = (status: string) => {
    switch (status) {
      case 'out_of_stock':
        return { icon: AlertOctagon, color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Sin stock' };
      case 'critical':
        return { icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-400/10', label: 'Crítico' };
      case 'low':
        return { icon: AlertTriangle, color: 'text-amber-500', bgColor: 'bg-amber-500/10', label: 'Stock bajo' };
      default:
        return { icon: Package, color: 'text-muted-foreground', bgColor: 'bg-muted', label: status };
    }
  };

  // Máximo para barras de progreso de productos
  const maxSold = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.totalSold)) : 1;

  // Generar subtítulo dinámico según el período seleccionado
  const getSubtitle = () => {
    if (viewMode.type === 'days') {
      if (chartData.length > 0) {
        const firstDate = chartData[0].fullDate;
        const lastDate = chartData[chartData.length - 1].fullDate;
        return `Resumen general de tu negocio — ${firstDate} a ${lastDate}`;
      }
      return `Resumen general de tu negocio — Últimos ${viewMode.value} días`;
    } else {
      return `Resumen general de tu negocio — ${format(viewMode.date, 'MMMM yyyy', { locale: es })}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground text-sm">
            {getSubtitle()}
          </p>
        </div>
        
        {/* Period Controls */}
        <div className="flex items-center gap-2">
          {/* 7/30 days toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant={viewMode.type === 'days' && viewMode.value === 7 ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode({ type: 'days', value: 7 })}
            >
              7 días
            </Button>
            <Button
              variant={viewMode.type === 'days' && viewMode.value === 30 ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode({ type: 'days', value: 30 })}
            >
              30 días
            </Button>
          </div>

          {/* Month selector */}
          <MonthPicker
            value={viewMode.type === 'month' ? viewMode.date : undefined}
            onChange={(date) => setViewMode({ type: 'month', date })}
            className={viewMode.type === 'month' ? 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary' : ''}
          />
        </div>
      </div>

      {/* KPI Cards - Solo 3 cards ahora */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Ingresos */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '—' : formatCurrency(kpis?.revenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isLoading ? (
                  '—'
                ) : revenueChange >= 0 ? (
                  <span className="text-green-600">+{revenueChange.toFixed(0)}% vs período anterior</span>
                ) : (
                  <span className="text-red-500">{revenueChange.toFixed(0)}% vs período anterior</span>
                )}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pedidos */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '—' : kpis?.orders || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isLoading ? (
                  '—'
                ) : ordersChange >= 0 ? (
                  <span className="text-green-600">+{Math.round(ordersChange)} vs período anterior</span>
                ) : (
                  <span className="text-red-500">{Math.round(ordersChange)} vs período anterior</span>
                )}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stock Bajo */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Stock Bajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '—' : (kpis?.lowStockCount || 0) + (kpis?.outOfStockCount || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isLoading ? (
                  '—'
                ) : (
                  <span className="text-amber-600">
                    {kpis?.outOfStockCount || 0} sin stock
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Middle Row: Chart + Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {getChartTitle()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Cargando...
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey={viewMode.type === 'month' ? 'date' : 'dayName'}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dy={10}
                      interval={viewMode.type === 'month' ? 4 : 0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload;
                        return item?.fullDate || label;
                      }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Bar
                      dataKey="total"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No hay datos para mostrar
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Stock Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Alertas de Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando...</div>
              ) : stockAlerts.length > 0 ? (
                <div className="space-y-3">
                  {stockAlerts.map((alert) => {
                    const config = getStockStatusConfig(alert.status);
                    const Icon = config.icon;
                    return (
                      <div
                        key={alert.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className={`p-2 rounded-md ${config.bgColor}`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {capitalizeName(alert.name)}
                          </p>
                          <p className="text-xs text-muted-foreground">{config.label}</p>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {alert.stock} u.
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay alertas de stock
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row: Recent Orders + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Últimos Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando...</div>
              ) : recentOrders.length > 0 ? (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-sm font-medium">{order.number}</p>
                          <p className="text-xs text-muted-foreground">{order.customerName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getOrderStatusBadge(order.status)}
                        <span className="text-sm font-medium">
                          {formatCurrency(order.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay pedidos recientes
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Top Productos Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando...</div>
              ) : topProducts.length > 0 ? (
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <div key={product.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-muted-foreground w-5 flex-shrink-0">{index + 1}</span>
                          <span className="truncate" title={capitalizeName(product.name)}>
                            {capitalizeName(product.name)}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground flex-shrink-0 ml-2">
                          {product.totalSold} unidades
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(product.totalSold / maxSold) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {Math.round((product.totalSold / maxSold) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay datos de ventas
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
