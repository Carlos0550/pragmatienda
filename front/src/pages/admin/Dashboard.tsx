import React from 'react';
import { Package, ShoppingCart, Tag, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const stats = [
  { label: 'Productos', value: '—', icon: Package, color: 'text-info' },
  { label: 'Categorías', value: '—', icon: Tag, color: 'text-warning' },
  { label: 'Pedidos', value: '—', icon: ShoppingCart, color: 'text-success' },
  { label: 'Ingresos', value: '—', icon: TrendingUp, color: 'text-primary' },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Resumen general de tu negocio</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border bg-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold mb-4">Actividad reciente</h3>
        <div className="text-center py-8 text-sm text-muted-foreground">
          Conectá tu API para ver la actividad en tiempo real.
        </div>
      </div>
    </div>
  );
}
