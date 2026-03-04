import React, { useState, useEffect, useCallback, useRef } from 'react';
import { http } from '@/services/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart } from '@mui/x-charts';
import { sileo } from 'sileo';
import {
  ShoppingCart,
  Search,
  Barcode,
  Trash2,
  Pencil,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { capitalizeName } from '@/lib/utils';
import type {
  Category,
  Product,
  Sale,
  SaleMetricsPoint,
  PaymentProvider,
} from '@/types';

const PAGE_SIZE = 12;
const SALES_PAGE_SIZE = 20;

const PAYMENT_PROVIDERS: { value: PaymentProvider; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'DEBIT_CARD', label: 'Tarjeta débito' },
  { value: 'CREDIT_CARD', label: 'Tarjeta crédito' },
  { value: 'BANK_TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminSalesPage() {
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');

  // POS state
  const [posProducts, setPosProducts] = useState<Product[]>([]);
  const [posCategories, setPosCategories] = useState<Category[]>([]);
  const [posLoading, setPosLoading] = useState(true);
  const [posSearch, setPosSearch] = useState('');
  const [posDebouncedSearch, setPosDebouncedSearch] = useState('');
  const [posBarCodeInput, setPosBarCodeInput] = useState('');
  const [posCategoryFilter, setPosCategoryFilter] = useState<string>('');
  const [posPage, setPosPage] = useState(1);
  const [posTotal, setPosTotal] = useState(0);
  const [posTotalPages, setPosTotalPages] = useState(1);
  const [posCart, setPosCart] = useState<{ items: { productId: string; quantity: number; product: Product }[] } | null>(null);
  const [posCartLoading, setPosCartLoading] = useState(false);
  const [posCheckoutLoading, setPosCheckoutLoading] = useState(false);
  const [posPaymentProvider, setPosPaymentProvider] = useState<PaymentProvider>('CASH');
  const [posPostSaleOpen, setPosPostSaleOpen] = useState(false);
  const [posLastSaleIds, setPosLastSaleIds] = useState<string[]>([]);
  const [posLastSaleDetails, setPosLastSaleDetails] = useState<{
    items: { productId: string; quantity: number; product: Product }[];
    total: number;
    paymentProvider: string;
  } | null>(null);
  const [posDeleteSaleLoading, setPosDeleteSaleLoading] = useState(false);
  const barCodeInputRef = useRef<HTMLInputElement>(null);

  // History state
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesTotalPages, setSalesTotalPages] = useState(1);
  const [salesFrom, setSalesFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [salesTo, setSalesTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [metrics, setMetrics] = useState<SaleMetricsPoint[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editReplaceItem, setEditReplaceItem] = useState<{ orderItemId: string; productId: string; quantity: number } | null>(null);
  const [editProducts, setEditProducts] = useState<Product[]>([]);
  const [editProductSearch, setEditProductSearch] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchPosCart = useCallback(async () => {
    setPosCartLoading(true);
    try {
      const cart = await http.cart.get();
      setPosCart(cart);
    } catch {
      setPosCart(null);
    } finally {
      setPosCartLoading(false);
    }
  }, []);

  const loadPosProducts = useCallback(async () => {
    setPosLoading(true);
    try {
      const response = await http.products.listAdmin({
        page: posPage,
        limit: PAGE_SIZE,
        name: posDebouncedSearch.trim() || undefined,
        barCode: posBarCodeInput.trim() || undefined,
        categoryId: posCategoryFilter || undefined,
        status: 'PUBLISHED',
      });
      setPosProducts(response.items);
      setPosTotal(response.pagination.total);
      setPosTotalPages(response.pagination.totalPages);
    } finally {
      setPosLoading(false);
    }
  }, [posPage, posDebouncedSearch, posBarCodeInput, posCategoryFilter]);

  const loadPosCategories = useCallback(async () => {
    const items = await http.categories.listAdmin().catch(() => []);
    setPosCategories(items);
  }, []);

  useEffect(() => {
    void loadPosCategories();
  }, [loadPosCategories]);

  useEffect(() => {
    const t = window.setTimeout(() => setPosDebouncedSearch(posSearch), 350);
    return () => window.clearTimeout(t);
  }, [posSearch]);

  useEffect(() => {
    if (activeTab === 'pos') {
      void fetchPosCart();
    }
  }, [activeTab, fetchPosCart]);

  useEffect(() => {
    if (activeTab === 'pos') {
      void loadPosProducts();
    }
  }, [activeTab, loadPosProducts]);

  const handlePosAddProduct = async (product: Product, qty: number = 1) => {
    if (product.stock < qty) {
      sileo.error({ title: `Stock insuficiente. Disponible: ${product.stock}` });
      return;
    }
    setPosCartLoading(true);
    try {
      await http.cart.patchItemDelta(product.id, qty);
      await fetchPosCart();
    } catch {
      sileo.error({ title: 'Error al agregar' });
    } finally {
      setPosCartLoading(false);
    }
  };

  const handlePosBarCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = posBarCodeInput.trim();
    if (!code) return;
    setPosLoading(true);
    try {
      const response = await http.products.listAdmin({
        page: 1,
        limit: 1,
        barCode: code,
        status: 'PUBLISHED',
      });
      const product = response.items[0];
      if (product) {
        await handlePosAddProduct(product, 1);
        setPosBarCodeInput('');
        barCodeInputRef.current?.focus();
      } else {
        sileo.error({ title: 'Producto no encontrado' });
      }
    } finally {
      setPosLoading(false);
    }
  };

  const handlePosRemoveItem = async (productId: string) => {
    const item = posCart?.items.find((i) => i.productId === productId);
    if (!item) return;
    setPosCartLoading(true);
    try {
      await http.cart.patchItemDelta(productId, -item.quantity);
      await fetchPosCart();
    } catch {
      sileo.error({ title: 'Error al quitar' });
    } finally {
      setPosCartLoading(false);
    }
  };

  const handlePosCheckout = async () => {
    if (!posCart?.items?.length) {
      sileo.error({ title: 'Carrito vacío' });
      return;
    }
    setPosCheckoutLoading(true);
    try {
      const result = await http.cart.checkout(
        undefined as unknown as File,
        'sale',
        posPaymentProvider
      );
      if ('saleIds' in result && result.saleIds?.length) {
        setPosLastSaleIds(result.saleIds);
        setPosLastSaleDetails({
          items: posCart?.items ?? [],
          total: posCartTotal,
          paymentProvider: posPaymentProvider,
        });
        setPosPostSaleOpen(true);
        await fetchPosCart();
      } else {
        sileo.success({ title: 'Venta registrada' });
        await fetchPosCart();
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      sileo.error({ title: apiErr.message || 'Error al cobrar' });
    } finally {
      setPosCheckoutLoading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'pos') return;
      if (e.key === 'F9') {
        e.preventDefault();
        void handlePosCheckout();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, posCart?.items?.length, posCheckoutLoading]);

  const handlePosPostSaleContinue = () => {
    setPosPostSaleOpen(false);
    setPosLastSaleIds([]);
    setPosLastSaleDetails(null);
    barCodeInputRef.current?.focus();
  };

  const handlePosDeleteLastSale = async () => {
    if (!posLastSaleIds.length || posDeleteSaleLoading) return;
    setPosDeleteSaleLoading(true);
    try {
      for (const id of posLastSaleIds) {
        await http.sales.delete(id);
      }
      sileo.success({ title: 'Venta eliminada' });
      handlePosPostSaleContinue();
      await loadMetrics();
    } catch {
      sileo.error({ title: 'Error al eliminar' });
    } finally {
      setPosDeleteSaleLoading(false);
    }
  };

  useEffect(() => {
    if (posPostSaleOpen) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handlePosPostSaleContinue();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [posPostSaleOpen]);

  const loadSales = useCallback(async () => {
    setSalesLoading(true);
    try {
      const response = await http.sales.list({
        page: salesPage,
        limit: SALES_PAGE_SIZE,
        from: salesFrom,
        to: salesTo,
        sortBy: 'saleDate',
        sortOrder: 'desc',
      });
      setSales(response.items);
      setSalesTotal(response.pagination.total);
      setSalesTotalPages(response.pagination.totalPages);
    } finally {
      setSalesLoading(false);
    }
  }, [salesPage, salesFrom, salesTo]);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const response = await http.sales.getMetrics(salesFrom, salesTo, 'day');
      setMetrics(response.series);
    } finally {
      setMetricsLoading(false);
    }
  }, [salesFrom, salesTo]);

  useEffect(() => {
    void loadSales();
    void loadMetrics();
  }, [loadSales, loadMetrics]);

  const openSaleDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setDetailOpen(true);
  };

  const getSaleItems = (sale: Sale): { id: string; productId: string; quantity: number; unitPrice: number; product: { id: string; name: string } }[] => {
    if (sale.order?.items?.length) {
      return sale.order.items.map((i) => ({
        id: i.id,
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        product: i.product,
      }));
    }
    if (sale.orderItem) {
      return [{
        id: sale.orderItem.id,
        productId: sale.orderItem.product.id,
        quantity: sale.orderItem.quantity,
        unitPrice: sale.orderItem.unitPrice,
        product: sale.orderItem.product,
      }];
    }
    return [];
  };

  const openEditSale = async (sale: Sale) => {
    try {
      const full = await http.sales.getOne(sale.id);
      setEditingSale(full);
      setEditOpen(true);
      setEditReplaceItem(null);
      setEditProductSearch('');
      setEditProducts([]);
    } catch {
      sileo.error({ title: 'Error al cargar venta' });
    }
  };

  const loadEditProducts = useCallback(async () => {
    if (!editProductSearch.trim()) {
      setEditProducts([]);
      return;
    }
    const res = await http.products.listAdmin({
      page: 1,
      limit: 20,
      name: editProductSearch.trim(),
      status: 'PUBLISHED',
    });
    setEditProducts(res.items);
  }, [editProductSearch]);

  useEffect(() => {
    const t = window.setTimeout(loadEditProducts, 300);
    return () => clearTimeout(t);
  }, [editProductSearch, loadEditProducts]);

  const handleRemoveItem = async (saleId: string, orderItemId: string, allItemIds: string[]) => {
    if (allItemIds.length <= 1) {
      await handleDeleteSale(saleId);
      setEditOpen(false);
      setEditingSale(null);
      return;
    }
    setEditSaving(true);
    try {
      await http.sales.patchItems(saleId, { removeItemIds: [orderItemId] });
      sileo.success({ title: 'Item eliminado' });
      const updated = await http.sales.getOne(saleId);
      setEditingSale(updated);
      await loadSales();
      await loadMetrics();
    } catch (err: unknown) {
      const e = err as { message?: string };
      sileo.error({ title: e.message || 'Error al eliminar' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleApplyReplace = async () => {
    if (!editingSale || !editReplaceItem) return;
    setEditSaving(true);
    try {
      await http.sales.patchItems(editingSale.id, {
        replaceItems: [editReplaceItem],
      });
      sileo.success({ title: 'Item reemplazado' });
      setEditReplaceItem(null);
      const updated = await http.sales.getOne(editingSale.id);
      setEditingSale(updated);
      await loadSales();
      await loadMetrics();
    } catch (err: unknown) {
      const e = err as { message?: string };
      sileo.error({ title: e.message || 'Error al reemplazar' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSale = async (id: string) => {
    try {
      await http.sales.delete(id);
      sileo.success({ title: 'Venta eliminada' });
      setDetailOpen(false);
      setSelectedSale(null);
      if (editingSale?.id === id) {
        setEditOpen(false);
        setEditingSale(null);
      }
      await loadSales();
      await loadMetrics();
    } catch {
      sileo.error({ title: 'Error al eliminar' });
    }
  };

  const posCartTotal = posCart?.items?.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  ) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ventas</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Punto de venta y historial de ventas
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pos' | 'history')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pos" className="gap-2">
            <ShoppingCart className="h-4 w-4" /> POS
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Eye className="h-4 w-4" /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pos" className="mt-6">
          <div className="flex gap-6">
            <div className="flex-1 min-w-0">
              <form onSubmit={handlePosBarCodeSubmit} className="mb-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={barCodeInputRef}
                      value={posBarCodeInput}
                      onChange={(e) => setPosBarCodeInput(e.target.value)}
                      placeholder="Escanear código de barras..."
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" variant="secondary">
                    Buscar
                  </Button>
                </div>
              </form>

              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={posSearch}
                    onChange={(e) => {
                      setPosSearch(e.target.value);
                      setPosPage(1);
                    }}
                    placeholder="Buscar por nombre..."
                    className="pl-9"
                  />
                </div>
                <Select
                  value={posCategoryFilter || 'all'}
                  onValueChange={(v) => {
                    setPosCategoryFilter(v === 'all' ? '' : v);
                    setPosPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {posCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {posLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="animate-pulse h-32 rounded-lg bg-muted" />
                  ))}
                </div>
              ) : posProducts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No hay productos.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {posProducts.map((p) => {
                    const img = p.image || (p as { images?: string[] }).images?.[0];
                    const canAdd = (p.stock ?? 0) > 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => canAdd && handlePosAddProduct(p, 1)}
                        disabled={!canAdd || posCartLoading}
                        className="flex flex-col rounded-lg border bg-card p-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="aspect-square rounded-md bg-muted mb-2 overflow-hidden">
                          {img ? (
                            <img src={img} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">{capitalizeName(p.name)}</span>
                        <span className="text-xs text-muted-foreground">${p.price.toLocaleString()}</span>
                        {!canAdd && (
                          <span className="text-xs text-primary">Sin stock</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {posTotal} producto(s)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={posPage <= 1}
                    onClick={() => setPosPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm py-1">Pág. {posPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={posPage >= posTotalPages}
                    onClick={() => setPosPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="w-80 shrink-0 border rounded-xl bg-card p-4 flex flex-col">
              <h3 className="font-semibold mb-3">Carrito</h3>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
                {posCart?.items?.length ? (
                  posCart.items.map((i) => (
                    <div
                      key={i.productId}
                      className="flex items-center justify-between gap-2 text-sm border-b pb-2"
                    >
                      <span className="truncate flex-1">{capitalizeName(i.product.name)}</span>
                      <span>x{i.quantity}</span>
                      <span>${(i.product.price * i.quantity).toLocaleString()}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handlePosRemoveItem(i.productId)}
                        disabled={posCartLoading}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Vacío</p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between font-semibold mb-3">
                  <span>Total</span>
                  <span>${posCartTotal.toLocaleString()}</span>
                </div>
                <Select
                  value={posPaymentProvider}
                  onValueChange={(v) => setPosPaymentProvider(v as PaymentProvider)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Método de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_PROVIDERS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full mt-3"
                  onClick={() => void handlePosCheckout()}
                  disabled={!posCart?.items?.length || posCheckoutLoading}
                >
                  {posCheckoutLoading ? 'Procesando...' : 'Cobrar (F9)'}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={salesFrom}
                onChange={(e) => setSalesFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={salesTo}
                onChange={(e) => setSalesTo(e.target.value)}
              />
            </div>
          </div>

          {metricsLoading ? (
            <div className="h-64 animate-pulse rounded-xl bg-muted mb-6" />
          ) : metrics.length > 0 ? (
            <div className="h-64 rounded-xl border bg-card p-4 mb-6">
              <LineChart
                dataset={metrics as { date: string; total: number }[]}
                xAxis={[{ scaleType: 'point', dataKey: 'date', valueFormatter: (v) => formatDateShort(v) }]}
                series={[
                  {
                    dataKey: 'total',
                    label: 'Total',
                    valueFormatter: (v) => `$${Number(v).toLocaleString()}`,
                  },
                ]}
                height={240}
                margin={{ top: 10, right: 10, bottom: 30, left: 50 }}
                grid={{ vertical: true, horizontal: true }}
              />
            </div>
          ) : null}

          {salesLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse h-14 rounded-xl bg-muted" />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No hay ventas en el período seleccionado.</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{formatDate(s.saleDate)}</TableCell>
                      <TableCell>${s.total.toLocaleString()}</TableCell>
                      <TableCell>
                        {PAYMENT_PROVIDERS.find((p) => p.value === s.paymentProvider)?.label ?? s.paymentProvider}
                      </TableCell>
                      <TableCell>{s.status}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openSaleDetail(s)}
                          aria-label="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditSale(s)}
                          aria-label="Editar venta"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPendingDeleteId(s.id);
                            setDeleteDialogOpen(true);
                          }}
                          aria-label="Eliminar venta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {salesTotal} venta(s)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={salesPage <= 1}
                onClick={() => setSalesPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm py-1">Pág. {salesPage}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={salesPage >= salesTotalPages}
                onClick={() => setSalesPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={posPostSaleOpen} onOpenChange={setPosPostSaleOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Venta registrada</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Se registraron {posLastSaleIds.length} venta(s) correctamente.
          </p>
          {posLastSaleDetails && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Detalle de la venta</p>
              <ul className="space-y-1.5 text-sm">
                {posLastSaleDetails.items.map((i) => (
                  <li key={i.productId} className="flex justify-between gap-2">
                    <span className="truncate">{capitalizeName(i.product.name)}</span>
                    <span>x{i.quantity}</span>
                    <span>${(i.product.price * i.quantity).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total</span>
                <span>${posLastSaleDetails.total.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Método: {PAYMENT_PROVIDERS.find((p) => p.value === posLastSaleDetails.paymentProvider)?.label ?? posLastSaleDetails.paymentProvider}
              </p>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => void handlePosDeleteLastSale()}
              disabled={posDeleteSaleLoading}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              {posDeleteSaleLoading ? 'Eliminando...' : 'Eliminar venta'}
            </Button>
            <Button onClick={handlePosPostSaleContinue} autoFocus className="w-full sm:w-auto order-1 sm:order-2">
              Seguir cobrando (Enter)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de venta</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <p>
                <span className="text-muted-foreground">Fecha:</span>{' '}
                {formatDate(selectedSale.saleDate)}
              </p>
              <p>
                <span className="text-muted-foreground">Total:</span> $
                {selectedSale.total.toLocaleString()}
              </p>
              <p>
                <span className="text-muted-foreground">Método:</span>{' '}
                {PAYMENT_PROVIDERS.find((p) => p.value === selectedSale.paymentProvider)?.label ??
                  selectedSale.paymentProvider}
              </p>
              <div>
                <span className="text-muted-foreground">Items:</span>
                <ul className="mt-2 space-y-1">
                  {selectedSale.order?.items?.map((i) => (
                    <li key={i.id}>
                      {i.product.name} x{i.quantity} - $
                      {(i.unitPrice * i.quantity).toLocaleString()}
                    </li>
                  ))}
                  {selectedSale.orderItem && (
                    <li>
                      {selectedSale.orderItem.product.name} x{selectedSale.orderItem.quantity} - $
                      {(
                        selectedSale.orderItem.unitPrice * selectedSale.orderItem.quantity
                      ).toLocaleString()}
                    </li>
                  )}
                </ul>
              </div>
              <Button
                variant="destructive"
                onClick={() => {
                  setDetailOpen(false);
                  void handleDeleteSale(selectedSale.id);
                }}
              >
                Eliminar venta
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar venta</DialogTitle>
          </DialogHeader>
          {editingSale && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Fecha: {formatDate(editingSale.saleDate)} · Método:{' '}
                {PAYMENT_PROVIDERS.find((p) => p.value === editingSale.paymentProvider)?.label ?? editingSale.paymentProvider}
              </p>
              <div>
                <p className="text-sm font-medium mb-2">Items</p>
                <ul className="space-y-2">
                  {getSaleItems(editingSale).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3 bg-muted/20"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{capitalizeName(item.product.name)}</p>
                        <p className="text-xs text-muted-foreground">
                          x{item.quantity} · ${(item.unitPrice * item.quantity).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditReplaceItem({
                            orderItemId: item.id,
                            productId: item.productId,
                            quantity: item.quantity,
                          })}
                          disabled={editSaving}
                        >
                          Reemplazar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(
                            editingSale.id,
                            item.id,
                            getSaleItems(editingSale).map((i) => i.id)
                          )}
                          disabled={editSaving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm font-semibold">
                Total: ${editingSale.total.toLocaleString()}
              </p>
              {editReplaceItem && (
                <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                  <p className="text-sm font-medium">Reemplazar por otro producto</p>
                  <Input
                    placeholder="Buscar producto..."
                    value={editProductSearch}
                    onChange={(e) => setEditProductSearch(e.target.value)}
                  />
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {editProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditReplaceItem((prev) =>
                          prev ? { ...prev, productId: p.id } : null
                        )}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-muted ${
                          editReplaceItem?.productId === p.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        {capitalizeName(p.name)} · ${p.price.toLocaleString()}
                        {(p.stock ?? 0) > 0 ? ` (stock: ${p.stock})` : ' · Sin stock'}
                      </button>
                    ))}
                    {editProductSearch && editProducts.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Sin resultados</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editReplaceItem?.quantity ?? 1}
                      onChange={(e) => setEditReplaceItem((prev) =>
                        prev ? { ...prev, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) } : null
                      )}
                      className="w-20"
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleApplyReplace()}
                      disabled={editSaving}
                    >
                      Aplicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditReplaceItem(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar venta</AlertDialogTitle>
            <AlertDialogDescription>
              Se restaurará el stock de los productos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteId) void handleDeleteSale(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
