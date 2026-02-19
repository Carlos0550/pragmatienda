import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { sileo } from 'sileo';
import { Plus, Pencil, CreditCard } from 'lucide-react';
import type { Plan } from '@/types';
import type { ApiError } from '@/services/api';

const emptyForm = { name: '', price: '', interval: 'month', features: '', active: true, productLimit: '' };

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    try {
      const data = await api.get<Plan[]>('/admin/plans');
      setPlans(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setErrors({}); setDialogOpen(true); };
  const openEdit = (p: Plan) => {
    setEditing(p);
    setForm({
      name: p.name, price: String(p.price), interval: p.interval,
      features: p.features?.join('\n') || '', active: p.active,
      productLimit: p.productLimit ? String(p.productLimit) : '',
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    const payload = {
      name: form.name, price: parseFloat(form.price), interval: form.interval,
      features: form.features.split('\n').map((s) => s.trim()).filter(Boolean),
      active: form.active, productLimit: form.productLimit ? parseInt(form.productLimit) : undefined,
    };
    try {
      if (editing) {
        await api.patch(`/admin/plans/${editing.id}`, payload);
        sileo.success({ title: 'Plan actualizado' });
      } else {
        await api.post('/admin/plans', payload);
        sileo.success({ title: 'Plan creado' });
      }
      setDialogOpen(false);
      fetchPlans();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(apiErr.errors).forEach(([k, v]) => { fieldErrors[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(fieldErrors);
      } else { sileo.error({ title: 'Error al guardar' }); }
    } finally { setSaving(false); }
  };

  const handleToggle = async (plan: Plan) => {
    try {
      await api.patch(`/admin/plans/${plan.id}`, { active: !plan.active });
      sileo.success({ title: plan.active ? 'Plan desactivado' : 'Plan activado' });
      fetchPlans();
    } catch { sileo.error({ title: 'Error' }); }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Planes</h2>
          <p className="text-muted-foreground text-sm mt-1">Gestioná los planes de suscripción de la plataforma</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Nuevo Plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nuevo'} Plan</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={handleChange('name')} required />
                {errors.name && <p className="text-xs text-primary">{errors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Precio</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={handleChange('price')} required />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo</Label>
                  <Input value={form.interval} onChange={handleChange('interval')} placeholder="month" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Límite de productos</Label>
                <Input type="number" value={form.productLimit} onChange={handleChange('productLimit')} placeholder="Sin límite" />
              </div>
              <div className="space-y-2">
                <Label>Features (una por línea)</Label>
                <Textarea value={form.features} onChange={handleChange('features')} rows={4} placeholder="Feature 1&#10;Feature 2" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} />
                <Label>Activo</Label>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="animate-pulse h-24 rounded-xl bg-muted" />)}</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No hay planes creados aún.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className={`rounded-xl border p-5 space-y-3 ${plan.active ? 'bg-card' : 'bg-muted/50 opacity-70'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{plan.name}</h3>
                <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}><Pencil className="h-4 w-4" /></Button>
              </div>
              <p className="text-2xl font-bold">${plan.price}<span className="text-sm text-muted-foreground font-normal">/{plan.interval}</span></p>
              {plan.productLimit && <p className="text-xs text-muted-foreground">Hasta {plan.productLimit} productos</p>}
              <ul className="space-y-1">
                {plan.features?.map((f, i) => <li key={i} className="text-sm text-muted-foreground">• {f}</li>)}
              </ul>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">{plan.active ? 'Activo' : 'Inactivo'}</span>
                <Switch checked={plan.active} onCheckedChange={() => handleToggle(plan)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
