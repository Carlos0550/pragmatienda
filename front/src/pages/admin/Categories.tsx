import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { sileo } from 'sileo';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Category } from '@/types';
import type { ApiError } from '@/services/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', image: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      const data = await api.get<Category[]>('/admin/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', image: '' }); setErrors({}); setDialogOpen(true); };
  const openEdit = (cat: Category) => { setEditing(cat); setForm({ name: cat.name, image: cat.image || '' }); setErrors({}); setDialogOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/categories/${editing.id}`, form);
        sileo.success({ title: 'Categoría actualizada' });
      } else {
        await api.post('/admin/categories', form);
        sileo.success({ title: 'Categoría creada' });
      }
      setDialogOpen(false);
      fetchCategories();
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
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      sileo.success({ title: 'Categoría eliminada' });
      fetchCategories();
    } catch { sileo.error({ title: 'Error al eliminar' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Categorías</h2>
          <p className="text-muted-foreground text-sm mt-1">Gestioná las categorías de tus productos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Nueva</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nueva'} Categoría</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
                {errors.name && <p className="text-xs text-primary">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>URL de imagen</Label>
                <Input value={form.image} onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))} placeholder="https://..." />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="animate-pulse h-16 rounded-xl bg-muted" />)}</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No hay categorías aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card">
              {cat.image && <img src={cat.image} alt={cat.name} className="w-10 h-10 rounded-lg object-cover" />}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{cat.name}</h3>
                {cat.productCount !== undefined && <p className="text-xs text-muted-foreground">{cat.productCount} productos</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(cat.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
