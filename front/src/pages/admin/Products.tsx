import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Plus, Pencil, Trash2, ShoppingBag } from 'lucide-react';
import type { Product, Category } from '@/types';
import type { ApiError } from '@/services/api';

const emptyForm = {
  name: '', price: '', categoryId: '',
  stock: '', active: true,
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imagePreviewRef = useRef(imagePreview);

  const fetchData = async () => {
    try {
      const [prods, cats] = await Promise.all([
        api.get<Product[]>('/admin/products').catch(() => []),
        api.get<Category[]>('/admin/categories').catch(() => []),
      ]);
      const extractItems = <T,>(data: unknown): T[] => {
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') {
          const d = data as { data?: { items?: T[] }; items?: T[] };
          if (Array.isArray(d.data?.items)) return d.data.items;
          if (Array.isArray(d.items)) return d.items;
        }
        return [];
      };
      setProducts(extractItems<Product>(prods));
      setCategories(extractItems<Category>(cats));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    imagePreviewRef.current = imagePreview;
  }, [imagePreview]);

  useEffect(() => {
    return () => {
      if (imagePreviewRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewRef.current);
      }
    };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setImageFile(null);
    setImagePreview('');
    setDialogOpen(true);
  };
  const openEdit = (p: Product) => {
    const existingImage = p.image || p.images?.[0] || '';
    setEditing(p);
    setForm({
      name: p.name, price: String(p.price),
      categoryId: p.categoryId || '',
      stock: String(p.stock),
      active: p.status ? p.status === 'PUBLISHED' : p.active,
    });
    setErrors({});
    setImageFile(null);
    setImagePreview(existingImage);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('price', form.price);
    formData.append('stock', form.stock);
    formData.append('status', form.active ? 'PUBLISHED' : 'UNPUBLISHED');
    if (form.categoryId) formData.append('categoryId', form.categoryId);
    if (imageFile) formData.append('image', imageFile);
    try {
      if (editing) {
        await api.putMultipart(`/admin/products/${editing.id}`, formData);
        sileo.success({ title: 'Producto actualizado' });
      } else {
        await api.postMultipart('/admin/products', formData);
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
    try { await api.delete(`/admin/products/${id}`); sileo.success({ title: 'Eliminado' }); fetchData(); } catch { sileo.error({ title: 'Error' }); }
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

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    setImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : '';
    });
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
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nuevo'} Producto</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={handleChange('name')} required />
                {errors.name && <p className="text-xs text-primary">{errors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Precio</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={handleChange('price')} required />
                  {errors.price && <p className="text-xs text-primary">{errors.price}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input type="number" value={form.stock} onChange={handleChange('stock')} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Estado</Label>
                  <div className="flex items-center gap-3 h-10">
                    <Switch checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} />
                    <Label>Activo</Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Imagen</Label>
                <div className="rounded-lg border bg-muted/30 p-3">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Imagen del producto" className="h-36 w-full object-cover rounded" />
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin imagen cargada</p>
                  )}
                </div>
                <Input type="file" accept="image/*" onChange={handleImageChange} />
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
          {products.map((p) => {
            const isActive = p.status ? p.status === 'PUBLISHED' : p.active;
            return (
            <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                {(p.image || p.images?.[0]) ? (
                  <img src={p.image || p.images?.[0]} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-4 w-4 text-muted-foreground/30" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{p.name}</h3>
                <p className="text-xs text-muted-foreground">${p.price.toLocaleString()} · Stock: {p.stock}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {isActive ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          );})}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. ¿Querés eliminar este producto?
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
