import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { Category } from '@/types';
import type { ApiError } from '@/services/api';
import { capitalizeName } from '@/lib/utils';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', image: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: { items: Category[] } }>('/admin/categories');
      setCategories(data?.data?.items || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', image: '' });
    setImageFile(null);
    setErrors({});
    setDialogOpen(true);
  };
  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, image: cat.image || '' });
    setImageFile(null);
    setErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (editing) {
        await api.putMultipart(`/admin/categories/${editing.id}`, formData);
        sileo.success({ title: 'Categoría actualizada' });
      } else {
        await api.postMultipart('/admin/categories', formData);
        sileo.success({ title: 'Categoría creada' });
      }
      setDialogOpen(false);
      setImageFile(null);
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
    setDeletingId(id);
    try {
      await api.delete(`/admin/categories/${id}`);
      sileo.success({ title: 'Categoría eliminada' });
      await fetchCategories();
    } catch { sileo.error({ title: 'Error al eliminar' }); }
    finally { setDeletingId(null); }
  };

  const openDeleteDialog = (id: string) => {
    setPendingDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleteDialogOpen(false);
    await handleDelete(pendingDeleteId);
    setPendingDeleteId(null);
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
                <Label>Imagen</Label>
                {form.image && !imageFile && (
                  <img src={form.image} alt="Imagen actual" className="w-16 h-16 rounded-lg object-cover" />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
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
                <h3 className="font-medium text-sm">{capitalizeName(cat.name)}</h3>
                {cat.productCount !== undefined && <p className="text-xs text-muted-foreground">{cat.productCount} productos</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(cat)} disabled={deletingId === cat.id}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(cat.id)} disabled={deletingId === cat.id}>
                  {deletingId === cat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoría</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. ¿Querés eliminar esta categoría?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
