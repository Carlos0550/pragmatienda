import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { http } from '@/services/http';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { sileo } from 'sileo';
import { Eye, Plus, Pencil, Trash2, ShoppingBag, Search } from 'lucide-react';
import { toFormErrors } from '@/lib/api-utils';
import type { ApiError, Category, FormErrors, Product, ProductFormState } from '@/types';

const PAGE_SIZE = 10;

const emptyForm: ProductFormState = {
  name: '',
  price: '',
  categoryId: '',
  stock: '',
  active: true,
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const imagePreviewRef = useRef(imagePreview);

  const loadCategories = useCallback(async () => {
    const items = await http.categories.listAdmin().catch(() => []);
    setCategories(items);
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.products.listAdmin({
        page,
        limit: PAGE_SIZE,
        name: debouncedSearch.trim() || undefined,
      });
      const items = response.items;
      const pagination = response.pagination;
      const nextTotal = pagination.total;
      const nextTotalPages = pagination.totalPages;

      setProducts(items);
      setTotal(nextTotal);
      setTotalPages(nextTotalPages);

      if (pagination?.page && pagination.page !== page) {
        setPage(pagination.page);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

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
      name: p.name,
      price: String(p.price),
      categoryId: p.categoryId || p.category?.id || '',
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
        await http.products.updateAdmin(editing.id, formData);
        sileo.success({ title: 'Producto actualizado' });
      } else {
        await http.products.createAdmin(formData);
        sileo.success({ title: 'Producto creado' });
      }
      setDialogOpen(false);
      await loadProducts();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        setErrors(toFormErrors(apiErr.errors));
      } else {
        sileo.error({ title: 'Error al guardar' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await http.products.deleteAdmin(id);
      sileo.success({ title: 'Eliminado' });
      await loadProducts();
    } catch {
      sileo.error({ title: 'Error' });
    }
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

  const handleChange = (field: keyof ProductFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Productos</h2>
          <p className="text-muted-foreground text-sm mt-1">Gestioná tu catálogo de productos</p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nombre..."
              className="pl-9"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" /> Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar' : 'Nuevo'} Producto</DialogTitle>
              </DialogHeader>
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
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
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
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse h-16 rounded-xl bg-muted" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No se encontraron productos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  console.log(p);
                  const isActive = p.status ? p.status === 'PUBLISHED' : p.active;
                  const image = p.image || p.images?.[0];
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="w-10 h-10 rounded-md overflow-hidden bg-muted shrink-0">
                            {image ? (
                              <img src={image} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag className="h-4 w-4 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-medium truncate">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{p.category.name ?? 'Sin categoría'}</TableCell>
                      <TableCell className="text-right">${p.price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{p.stock}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex text-xs px-2 py-1 rounded-full ${
                            isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/products/${p.slug || p.id}`} target="_blank" rel="noreferrer" aria-label={`Ver ${p.name}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)} aria-label={`Editar ${p.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(p.id)} aria-label={`Eliminar ${p.name}`}>
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

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              Mostrando {from}-{to} de {total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span>
                Página {page} de {Math.max(totalPages, 1)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.max(totalPages, 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
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
