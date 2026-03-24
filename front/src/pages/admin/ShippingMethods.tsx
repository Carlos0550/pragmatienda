import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Store, Bike, Truck } from 'lucide-react';
import { sileo } from 'sileo';
import { http } from '@/services/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ShippingMethod, ShippingProviderCode, ShippingZoneRule } from '@/types';

type ShippingFormState = {
  id?: string;
  name: string;
  providerCode: ShippingProviderCode;
  isActive: boolean;
  availableInCheckout: boolean;
  availableInAdmin: boolean;
  displayOrder: string;
  instructions: string;
  zoneRules: ShippingZoneRule[];
};

const emptyForm: ShippingFormState = {
  name: '',
  providerCode: 'LOCAL_PICKUP',
  isActive: true,
  availableInCheckout: true,
  availableInAdmin: true,
  displayOrder: '0',
  instructions: '',
  zoneRules: [],
};

function iconForMethod(method: ShippingMethod) {
  if (method.providerCode === 'LOCAL_PICKUP') return Store;
  if (method.providerCode === 'CUSTOM_EXTERNAL') return Bike;
  return Truck;
}

function toFormState(method: ShippingMethod): ShippingFormState {
  const config = (method.config ?? {}) as Record<string, unknown>;

  return {
    id: method.id,
    name: method.name,
    providerCode: method.providerCode,
    isActive: method.isActive,
    availableInCheckout: method.availableInCheckout,
    availableInAdmin: method.availableInAdmin,
    displayOrder: String(method.displayOrder),
    instructions: String(config.instructions ?? ''),
    zoneRules: method.zoneRules?.length ? method.zoneRules : [],
  };
}

export default function ShippingMethodsPage() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ShippingFormState>(emptyForm);

  const isPickup = form.providerCode === 'LOCAL_PICKUP';
  const isExternal = form.providerCode === 'CUSTOM_EXTERNAL';

  const loadMethods = async () => {
    setLoading(true);
    try {
      const items = await http.shipping.listMethods();
      setMethods(items);
    } catch (error) {
      console.error(error);
      sileo.error({ title: 'No se pudieron cargar las formas de envío' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMethods();
  }, []);

  const openCreate = (providerCode: ShippingProviderCode) => {
    setForm({
      ...emptyForm,
      providerCode,
      name: providerCode === 'LOCAL_PICKUP' ? 'Retirar en local' : 'Moto mandados',
    });
    setDialogOpen(true);
  };

  const openEdit = (method: ShippingMethod) => {
    setForm(toFormState(method));
    setDialogOpen(true);
  };

  const updateZoneRule = (index: number, field: keyof ShippingZoneRule, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      zoneRules: prev.zoneRules.map((rule, i) => (
        i === index
          ? { ...rule, [field]: field === 'price' ? Number(value) : value }
          : rule
      )),
    }));
  };

  const buildPayload = () => ({
    name: form.name,
    providerCode: form.providerCode,
    kind: isPickup ? 'PICKUP' : 'EXTERNAL',
    isActive: form.isActive,
    availableInCheckout: form.availableInCheckout,
    availableInAdmin: form.availableInAdmin,
    displayOrder: Number(form.displayOrder || 0),
    config: {
      instructions: form.instructions || undefined,
    },
    zoneRules: isExternal
      ? form.zoneRules
          .filter((rule) => rule.province)
          .map((rule) => ({
            province: rule.province,
            locality: rule.locality || undefined,
            price: rule.price,
            isActive: rule.isActive ?? true,
            displayName: rule.displayName,
          }))
      : [],
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload();
      if (form.id) {
        await http.shipping.updateMethod(form.id, payload);
      } else {
        await http.shipping.createMethod(payload);
      }
      sileo.success({ title: 'Forma de envío guardada' });
      setDialogOpen(false);
      setForm(emptyForm);
      await loadMethods();
    } catch (error) {
      console.error(error);
      sileo.error({ title: 'No se pudo guardar la forma de envío' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await http.shipping.deleteMethod(id);
      sileo.success({ title: 'Forma de envío eliminada' });
      await loadMethods();
    } catch (error) {
      console.error(error);
      sileo.error({ title: 'No se pudo eliminar la forma de envío' });
    }
  };

  const handleToggle = async (method: ShippingMethod, isActive: boolean) => {
    try {
      await http.shipping.patchMethodStatus(method.id, isActive);
      setMethods((prev) => prev.map((item) => (item.id === method.id ? { ...item, isActive } : item)));
    } catch (error) {
      console.error(error);
      sileo.error({ title: 'No se pudo actualizar el estado' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Formas de envío</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configurá retiro en local y envíos manuales. Los couriers integrados quedarán para una próxima etapa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openCreate('LOCAL_PICKUP')}>
            <Store className="h-4 w-4 mr-2" />
            Retiro en local
          </Button>
          <Button onClick={() => openCreate('CUSTOM_EXTERNAL')}>
            <Plus className="h-4 w-4 mr-2" />
            Método externo
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Método</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Checkout</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Cargando formas de envío...
                </TableCell>
              </TableRow>
            ) : methods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Todavía no configuraste formas de envío.
                </TableCell>
              </TableRow>
            ) : methods.map((method) => {
              const Icon = iconForMethod(method);
              return (
                <TableRow key={method.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{method.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {method.providerCode === 'LOCAL_PICKUP' ? 'Retiro' : 'Envío manual'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{method.kind}</TableCell>
                  <TableCell>{method.availableInCheckout ? 'Sí' : 'No'}</TableCell>
                  <TableCell>{method.availableInAdmin ? 'Sí' : 'No'}</TableCell>
                  <TableCell>
                    <Switch checked={method.isActive} onCheckedChange={(checked) => void handleToggle(method, checked)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(method)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void handleDelete(method.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar' : 'Nueva'} forma de envío</DialogTitle>
            <DialogDescription>Configurá las opciones de envío disponibles.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre visible</Label>
                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Orden</Label>
                <Input type="number" value={form.displayOrder} onChange={(e) => setForm((prev) => ({ ...prev, displayOrder: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Activo</p>
                  <p className="text-xs text-muted-foreground">Disponible para usar</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Checkout</p>
                  <p className="text-xs text-muted-foreground">Visible en la tienda</p>
                </div>
                <Switch checked={form.availableInCheckout} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, availableInCheckout: checked }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Admin</p>
                  <p className="text-xs text-muted-foreground">Operable desde ventas</p>
                </div>
                <Switch checked={form.availableInAdmin} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, availableInAdmin: checked }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Instrucciones</Label>
              <Textarea
                value={form.instructions}
                onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))}
                rows={3}
                placeholder={
                  isPickup
                    ? 'Ej: Presentate con el número de pedido y tu DNI.'
                    : 'Ej: Coordinamos el envío manualmente una vez confirmada la compra.'
                }
              />
              {isPickup && (
                <p className="text-xs text-muted-foreground">
                  El horario y la dirección del retiro se toman desde <strong>Mi Negocio</strong>.
                </p>
              )}
            </div>

            {isExternal && (
              <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Zonas y precios fijos</h3>
                    <p className="text-xs text-muted-foreground">
                      Definí cuánto cuesta este envío según la zona del cliente.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      zoneRules: [...prev.zoneRules, { province: '', locality: '', price: 0, isActive: true }],
                    }))}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar zona
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.zoneRules.map((rule, index) => (
                    <div key={`${rule.id ?? 'new'}-${index}`} className="grid grid-cols-12 gap-2 rounded-lg border p-3">
                      <div className="col-span-3">
                        <Label>Provincia</Label>
                        <Input value={rule.province} onChange={(e) => updateZoneRule(index, 'province', e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <Label>Localidad</Label>
                        <Input value={rule.locality} onChange={(e) => updateZoneRule(index, 'locality', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <Label>Precio final</Label>
                        <Input type="number" value={rule.price} onChange={(e) => updateZoneRule(index, 'price', e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <Label>Nombre de la zona</Label>
                        <Input value={rule.displayName ?? ''} onChange={(e) => updateZoneRule(index, 'displayName', e.target.value)} />
                      </div>
                      <div className="col-span-1 flex items-end justify-end pb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setForm((prev) => ({
                            ...prev,
                            zoneRules: prev.zoneRules.filter((_, i) => i !== index),
                          }))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
