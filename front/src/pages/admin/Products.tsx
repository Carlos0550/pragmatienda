import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { sileo } from 'sileo';
import { Plus, Pencil, Trash2, ShoppingBag } from 'lucide-react';
import type { Product, Category } from '@/types';
import type { ApiError } from '@/services/api';

const emptyForm = {
  name: '', description: '', price: '', compareAtPrice: '', categoryId: '',
  images: '', stock: '', active: true, seoTitle: '', seoDescription: '',
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [prods, cats] = await Promise.all([
        api.get<Product[]>('/admin/products').catch(() => []),
        api.get<Category[]>('/admin/categories').catch(() => []),
      ]);
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setErrors({}); setDialogOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description, price: String(p.price),
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '',
      categoryId: p.categoryId, images: p.images?.join(', ') || '',
      stock: String(p.stock), active: p.active,
      seoTitle: p.seoTitle || '', seoDescription: p.seoDescription || '',
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    const payload = {
      name: form.name, description: form.description,
      price: parseFloat(form.price), compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : undefined,
      categoryId: form.categoryId, images: form.images.split(',').map((s) => s.trim()).filter(Boolean),
      stock: parseInt(form.stock), active: form.active,
      seoTitle: form.seoTitle || undefined, seoDescription: form.seoDescription || undefined,
    };
    try {
      if (editing) {
        await api.patch(`/admin/products/${editing.id}`, payload);
        sileo.success({ title: 'Producto actualizado' });
      } else {
        await api.post('/admin/products', payload);
        sileo.success({ title: 'Producto creado' });
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(apiErr.errors).forEach(([k, v]) => { fieldErrors[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(fieldErrors);
      } else { sileo.error({ title: 'Error al guardar' }); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try { await api.delete(`/admin/products/${id}`); sileo.success({ title: 'Eliminado' }); fetchData(); } catch { sileo.error({ title: 'Error' }); }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Productos</h2>
          <p className="text-muted-foreground text-sm mt-1">Gestioná tu catálogo de productos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nuevo'} Producto</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={handleChange('name')} required />
                {errors.name && <p className="text-xs text-primary">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea value={form.description} onChange={handleChange('description')} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Precio</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={handleChange('price')} required />
                  {errors.price && <p className="text-xs text-primary">{errors.price}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Precio anterior</Label>
                  <Input type="number" step="0.01" value={form.compareAtPrice} onChange={handleChange('compareAtPrice')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={form.categoryId} onValueChange={(v) => setForm((p) => ({ ...p, categoryId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input type="number" value={form.stock} onChange={handleChange('stock')} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>URLs de imágenes (separadas por coma)</Label>
                <Input value={form.images} onChange={handleChange('images')} placeholder="https://img1.jpg, https://img2.jpg" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} />
                <Label>Activo</Label>
              </div>
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-semibold">SEO</h4>
                <div className="space-y-2">
                  <Label>Título SEO</Label>
                  <Input value={form.seoTitle} onChange={handleChange('seoTitle')} maxLength={60} />
                </div>
                <div className="space-y-2">
                  <Label>Descripción SEO</Label>
                  <Textarea value={form.seoDescription} onChange={handleChange('seoDescription')} maxLength={160} rows={2} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="animate-pulse h-20 rounded-xl bg-muted" />)}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No hay productos aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-4 w-4 text-muted-foreground/30" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{p.name}</h3>
                <p className="text-xs text-muted-foreground">${p.price.toLocaleString()} · Stock: {p.stock}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${p.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {p.active ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
