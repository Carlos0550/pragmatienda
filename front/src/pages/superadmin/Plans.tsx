import React, { useState, useEffect } from 'react';
import { http } from '@/services/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { sileo } from 'sileo';
import { Plus, Pencil, CreditCard, Trash2 } from 'lucide-react';
import { toFormErrors } from '@/lib/api-utils';
import type { ApiError, FormErrors, Plan, PlanFormState, PlanMutationPayload } from '@/types';

const PLAN_CODES = ['FREE', 'STARTER', 'PRO'] as const;
const emptyForm: PlanFormState = {
  code: 'STARTER',
  name: '',
  price: '',
  interval: 'month',
  trialDays: '0',
  features: '',
  active: true,
  maxProducts: '',
  maxCategories: '',
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeletePlan, setPendingDeletePlan] = useState<Plan | null>(null);

  const fetchPlans = async () => {
    try {
      const data = await http.superadmin.listPlans();
      const list = Array.isArray(data) ? data : (data && typeof data === 'object' && 'data' in data ? (data as { data: Plan[] }).data : []);
      setPlans(list ?? []);
    } catch {
      // Intencional: si falla, se muestra la lista vacía.
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setErrors({}); setDialogOpen(true); };
  const openEdit = (p: Plan) => {
    setEditing(p);
    const feat =
      typeof p.features === 'object' && !Array.isArray(p.features)
        ? Object.keys(p.features).filter((k) => (p.features as Record<string, boolean>)[k]).join('\n')
        : Array.isArray(p.features)
          ? p.features.join('\n')
          : '';
    setForm({
      code: p.code || 'STARTER',
      name: p.name,
      price: String(p.price),
      interval: p.interval,
      trialDays: p.trialDays != null ? String(p.trialDays) : '0',
      features: feat,
      active: p.active,
      maxProducts: p.maxProducts != null ? String(p.maxProducts) : '',
      maxCategories: p.maxCategories != null ? String(p.maxCategories) : '',
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    const featureKeys = form.features.split('\n').map((s) => s.trim()).filter(Boolean);
    const featuresObj = featureKeys.length ? Object.fromEntries(featureKeys.map((k) => [k, true])) : undefined;
    const payload: PlanMutationPayload = {
      name: form.name,
      price: parseFloat(form.price),
      interval: form.interval,
      trialDays: form.trialDays ? parseInt(form.trialDays, 10) : undefined,
      active: form.active,
      maxProducts: form.maxProducts ? parseInt(form.maxProducts, 10) : null,
      maxCategories: form.maxCategories ? parseInt(form.maxCategories, 10) : null,
      features: featuresObj ?? null,
    };
    if (!editing) {
      (payload as PlanMutationPayload).code = form.code as 'FREE' | 'STARTER' | 'PRO';
    }
    try {
      if (editing) {
        await http.superadmin.updatePlan(editing.id, payload);
        sileo.success({ title: 'Plan actualizado' });
      } else {
        await http.superadmin.createPlan(payload);
        sileo.success({ title: 'Plan creado' });
      }
      setDialogOpen(false);
      fetchPlans();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        setErrors(toFormErrors(apiErr.errors));
      } else {
        sileo.error({ title: apiErr.message || 'Error al guardar' });
      }
    } finally { setSaving(false); }
  };

  const handleToggle = async (plan: Plan) => {
    try {
      await http.superadmin.updatePlan(plan.id, { active: !plan.active });
      sileo.success({ title: plan.active ? 'Plan desactivado' : 'Plan activado' });
      fetchPlans();
    } catch (err) {
      const apiErr = err as ApiError;
      sileo.error({ title: apiErr.message || 'Error' });
    }
  };

  const openDeleteDialog = (plan: Plan) => {
    setPendingDeletePlan(plan);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeletePlan) return;
    try {
      await http.superadmin.deletePlan(pendingDeletePlan.id);
      sileo.success({ title: 'Plan desactivado' });
      await fetchPlans();
    } catch (err) {
      const apiErr = err as ApiError;
      sileo.error({ title: apiErr.message || 'Error al desactivar el plan' });
    } finally {
      setDeleteDialogOpen(false);
      setPendingDeletePlan(null);
    }
  };

  const handleChange = (field: keyof PlanFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
              {!editing && (
                <div className="space-y-2">
                  <Label>Código del plan</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  >
                    {PLAN_CODES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.code && <p className="text-xs text-primary">{errors.code}</p>}
                </div>
              )}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Límite productos</Label>
                  <Input type="number" min={0} value={form.maxProducts} onChange={handleChange('maxProducts')} placeholder="Sin límite" />
                </div>
                <div className="space-y-2">
                  <Label>Límite categorías</Label>
                  <Input type="number" min={0} value={form.maxCategories} onChange={handleChange('maxCategories')} placeholder="Sin límite" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Días de trial</Label>
                <Input type="number" min={0} value={form.trialDays} onChange={handleChange('trialDays')} />
              </div>
              <div className="space-y-2">
                <Label>Features (una por línea, claves habilitadas)</Label>
                <Textarea value={form.features} onChange={handleChange('features')} rows={3} placeholder="reports&#10;api" />
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
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(plan)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-2xl font-bold">${plan.price}<span className="text-sm text-muted-foreground font-normal">/{plan.interval}</span></p>
              {(plan.maxProducts != null || plan.maxCategories != null) && (
                <p className="text-xs text-muted-foreground">
                  {plan.maxProducts != null && `Hasta ${plan.maxProducts} productos`}
                  {plan.maxProducts != null && plan.maxCategories != null && ' · '}
                  {plan.maxCategories != null && `Hasta ${plan.maxCategories} categorías`}
                </p>
              )}
              <ul className="space-y-1">
                {typeof plan.features === 'object' && !Array.isArray(plan.features)
                  ? Object.entries(plan.features)
                      .filter(([, v]) => v)
                      .map(([k]) => <li key={k} className="text-sm text-muted-foreground">• {k}</li>)
                  : Array.isArray(plan.features) && plan.features.map((f, i) => <li key={i} className="text-sm text-muted-foreground">• {f}</li>)}
              </ul>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">{plan.active ? 'Activo' : 'Inactivo'}</span>
                <Switch checked={plan.active} onCheckedChange={() => handleToggle(plan)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar plan</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeletePlan
                ? `Se desactivará el plan ${pendingDeletePlan.name}. Esta acción también se sincroniza con Mercado Pago.`
                : 'Se desactivará el plan seleccionado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeletePlan(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Desactivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
