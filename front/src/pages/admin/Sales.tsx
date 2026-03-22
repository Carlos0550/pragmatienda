import React, { useState, useEffect, useCallback, useRef } from 'react';
import { http } from '@/services/http';
import { dayjs } from '@/config/dayjs';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LineChart } from '@mui/x-charts';
import { sileo } from 'sileo';
import {
  ShoppingCart,
  Search,
  Barcode,
  Minus,
  Plus,
  Trash2,
  Loader2,
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
  ApiError,
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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  REQUIRES_ACTION: 'Requiere acción',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pagado',
  FAILED: 'Fallido',
  REFUNDED: 'Reembolsado',
  PARTIALLY_REFUNDED: 'Reembolso parcial',
  CANCELED: 'Cancelado',
  EXPIRED: 'Expirado',
};

const PAYMENT_STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  REQUIRES_ACTION: 'secondary',
  AUTHORIZED: 'default',
  PAID: 'default',
  FAILED: 'destructive',
  REFUNDED: 'outline',
  PARTIALLY_REFUNDED: 'outline',
  CANCELED: 'destructive',
  EXPIRED: 'outline',
};

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

function getApiErrorMessage(err: unknown, fallback: string) {
  const apiErr = err as Partial<ApiError> | undefined;
  return apiErr?.message || fallback;
}

function normalizeBarCode(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

const MIN_SCANNER_CODE_LENGTH = 6;
const SCANNER_KEY_INTERVAL_MS = 120;
const SCANNER_BUFFER_TIMEOUT_MS = 180;

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
  const [posAddingProductId, setPosAddingProductId] = useState<string | null>(null);
  const [posItemUpdating, setPosItemUpdating] = useState<{ productId: string; action: 'inc' | 'dec' | 'remove' } | null>(null);
  const [posRemovingProductId, setPosRemovingProductId] = useState<string | null>(null);
  const [posClearingCart, setPosClearingCart] = useState(false);
  const [posCheckoutLoading, setPosCheckoutLoading] = useState(false);
  const [posBarCodeSearching, setPosBarCodeSearching] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);
  const [posPaymentProvider, setPosPaymentProvider] = useState<PaymentProvider>('CASH');
  const [posPostSaleOpen, setPosPostSaleOpen] = useState(false);
  const [posLastSaleIds, setPosLastSaleIds] = useState<string[]>([]);
  const [posLastSaleDetails, setPosLastSaleDetails] = useState<{
    items: { productId: string; quantity: number; product: Product }[];
    total: number;
    paymentProvider: string;
  } | null>(null);
  const [posDeleteSaleLoading, setPosDeleteSaleLoading] = useState(false);
  const [posCartModalOpen, setPosCartModalOpen] = useState(false);
  const barCodeInputRef = useRef<HTMLInputElement>(null);

  // History state
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesTotalPages, setSalesTotalPages] = useState(1);
  const [salesFrom, setSalesFrom] = useState(() => {
    return dayjs().subtract(1, "month").format("YYYY-MM-DD");
  });
  const [salesTo, setSalesTo] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [metrics, setMetrics] = useState<SaleMetricsPoint[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editReplaceItem, setEditReplaceItem] = useState<{ orderItemId: string; productId: string; quantity: number } | null>(null);
  const [editProducts, setEditProducts] = useState<Product[]>([]);
  const [editProductSearch, setEditProductSearch] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [paymentProofLoading, setPaymentProofLoading] = useState<Record<string, boolean>>({});
  const [paymentProofOpen, setPaymentProofOpen] = useState(false);
  const posProductsRequestIdRef = useRef(0);
  const salesRequestIdRef = useRef(0);
  const metricsRequestIdRef = useRef(0);
  const barCodeCacheRef = useRef<Map<string, Product>>(new Map());
  const scannerBufferRef = useRef('');
  const scannerLastKeyTimeRef = useRef(0);
  const scannerBufferTimeoutRef = useRef<number | null>(null);

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
    const requestId = ++posProductsRequestIdRef.current;
    setPosLoading(true);
    setPosError(null);
    try {
      const response = await http.products.listAdmin({
        page: posPage,
        limit: PAGE_SIZE,
        name: posDebouncedSearch.trim() || undefined,
        categoryId: posCategoryFilter || undefined,
        status: 'PUBLISHED',
      });
      if (requestId !== posProductsRequestIdRef.current) return;
      setPosProducts(response.items);
      setPosTotal(response.pagination.total);
      setPosTotalPages(response.pagination.totalPages);
    } catch (err) {
      if (requestId !== posProductsRequestIdRef.current) return;
      setPosError(getApiErrorMessage(err, 'No se pudieron cargar los productos del POS.'));
    } finally {
      if (requestId === posProductsRequestIdRef.current) {
        setPosLoading(false);
      }
    }
  }, [posPage, posDebouncedSearch, posCategoryFilter]);

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

  useEffect(() => {
    posProducts.forEach((product) => {
      const code = normalizeBarCode(product.barCode);
      if (code) barCodeCacheRef.current.set(code, product);
    });
  }, [posProducts]);

  useEffect(() => {
    (posCart?.items ?? []).forEach((item) => {
      const code = normalizeBarCode(item.product.barCode);
      if (code) barCodeCacheRef.current.set(code, item.product);
    });
  }, [posCart]);

  const findLocalProductByBarcode = useCallback((code: string) => {
    const normalized = normalizeBarCode(code);
    if (!normalized) return null;

    const fromProducts = posProducts.find((p) => normalizeBarCode(p.barCode) === normalized);
    if (fromProducts) return fromProducts;

    const fromCart = posCart?.items.find((i) => normalizeBarCode(i.product.barCode) === normalized)?.product;
    if (fromCart) return fromCart;

    return barCodeCacheRef.current.get(normalized) ?? null;
  }, [posProducts, posCart]);

  const handlePosAddProduct = useCallback(async (product: Product, qty: number = 1) => {
    if (product.stock < qty) {
      sileo.error({ title: `Stock insuficiente. Disponible: ${product.stock}` });
      return;
    }
    setPosCartLoading(true);
    setPosAddingProductId(product.id);
    try {
      await http.cart.patchItemDelta(product.id, qty);
      await fetchPosCart();
    } catch (err) {
      sileo.error({ title: getApiErrorMessage(err, 'Error al agregar el producto') });
    } finally {
      setPosCartLoading(false);
      setPosAddingProductId(null);
    }
  }, [fetchPosCart]);

  const handleScanCode = useCallback(async (rawCode: string) => {
    if (posBarCodeSearching) return;
    const code = rawCode.trim();
    if (!code) return;
    const normalizedCode = normalizeBarCode(code);
    const localProduct = findLocalProductByBarcode(normalizedCode);

    if (localProduct) {
      await handlePosAddProduct(localProduct, 1);
      return;
    }

    setPosBarCodeSearching(true);
    try {
      const response = await http.products.listAdmin({
        page: 1,
        limit: 1,
        barCode: code,
        status: 'PUBLISHED',
      });
      const product = response.items[0];
      if (product) {
        barCodeCacheRef.current.set(normalizeBarCode(product.barCode) || normalizedCode, product);
        await handlePosAddProduct(product, 1);
      } else {
        sileo.error({ title: 'Producto no encontrado' });
      }
    } catch (err) {
      sileo.error({ title: getApiErrorMessage(err, 'Error al buscar producto') });
    } finally {
      setPosBarCodeSearching(false);
    }
  }, [findLocalProductByBarcode, handlePosAddProduct, posBarCodeSearching]);

  const handlePosBarCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = posBarCodeInput.trim();
    if (!code) return;
    await handleScanCode(code);
    setPosBarCodeInput('');
    barCodeInputRef.current?.focus();
  };

  const handlePosRemoveItem = async (productId: string) => {
    const item = posCart?.items.find((i) => i.productId === productId);
    if (!item) return;
    setPosCartLoading(true);
    setPosRemovingProductId(productId);
    setPosItemUpdating({ productId, action: 'remove' });
    try {
      await http.cart.patchItemDelta(productId, -item.quantity);
      await fetchPosCart();
    } catch (err) {
      sileo.error({ title: getApiErrorMessage(err, 'Error al quitar el producto') });
    } finally {
      setPosCartLoading(false);
      setPosRemovingProductId(null);
      setPosItemUpdating(null);
    }
  };

  const handlePosChangeItemQuantity = async (productId: string, delta: 1 | -1) => {
    const item = posCart?.items.find((i) => i.productId === productId);
    if (!item) return;
    setPosCartLoading(true);
    setPosItemUpdating({ productId, action: delta > 0 ? 'inc' : 'dec' });
    try {
      await http.cart.patchItemDelta(productId, delta);
      await fetchPosCart();
    } catch (err) {
      sileo.error({ title: getApiErrorMessage(err, 'No se pudo actualizar la cantidad') });
    } finally {
      setPosCartLoading(false);
      setPosItemUpdating(null);
    }
  };

  const handlePosClearCart = async () => {
    if (!posCart?.items?.length || posClearingCart) return;
    setPosClearingCart(true);
    setPosCartLoading(true);
    try {
      await Promise.all(
        posCart.items.map((item) => http.cart.patchItemDelta(item.productId, -item.quantity))
      );
      await fetchPosCart();
      sileo.success({ title: 'Carrito limpiado' });
    } catch (err) {
      sileo.error({ title: getApiErrorMessage(err, 'No se pudo limpiar el carrito') });
    } finally {
      setPosCartLoading(false);
      setPosClearingCart(false);
    }
  };

  const handlePosCheckout = useCallback(async () => {
    if (posCheckoutLoading) return;
    if (!posCart?.items?.length) {
      sileo.error({ title: 'Carrito vacío' });
      return;
    }
    const currentCartTotal = posCart.items.reduce(
      (sum, i) => sum + i.product.price * i.quantity,
      0
    );
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
          total: currentCartTotal,
          paymentProvider: posPaymentProvider,
        });
        setPosCartModalOpen(false);
        setPosPostSaleOpen(true);
        await fetchPosCart();
        await loadPosProducts();
      } else {
        sileo.success({ title: 'Venta registrada' });
        setPosCartModalOpen(false);
        await fetchPosCart();
        await loadPosProducts();
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      sileo.error({ title: apiErr.message || 'Error al cobrar' });
    } finally {
      setPosCheckoutLoading(false);
    }
  }, [fetchPosCart, loadPosProducts, posCart, posCheckoutLoading, posPaymentProvider]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'pos') return;
      if (e.repeat) return;
      if (e.key === 'F9') {
        e.preventDefault();
        void handlePosCheckout();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, handlePosCheckout]);

  useEffect(() => {
    const clearBuffer = () => {
      scannerBufferRef.current = '';
      if (scannerBufferTimeoutRef.current) {
        window.clearTimeout(scannerBufferTimeoutRef.current);
        scannerBufferTimeoutRef.current = null;
      }
    };

    const onGlobalBarCodeKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'pos') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'F9') return;

      const target = e.target as HTMLElement | null;
      const isBarcodeInputFocused = target === barCodeInputRef.current;
      if (isBarcodeInputFocused) return;

      const isContentEditable = Boolean(target?.isContentEditable);
      if (isContentEditable || target?.tagName === 'TEXTAREA') return;

      const now = Date.now();

      if (e.key === 'Enter') {
        const code = scannerBufferRef.current.trim();
        if (code.length >= MIN_SCANNER_CODE_LENGTH) {
          e.preventDefault();
          void (async () => {
            setPosBarCodeInput(code);
            await handleScanCode(code);
            setPosBarCodeInput('');
          })();
        }
        clearBuffer();
        return;
      }

      if (e.key.length !== 1) return;

      const elapsed = now - scannerLastKeyTimeRef.current;
      if (elapsed > SCANNER_KEY_INTERVAL_MS) {
        scannerBufferRef.current = '';
      }
      scannerLastKeyTimeRef.current = now;
      scannerBufferRef.current += e.key;

      if (scannerBufferTimeoutRef.current) {
        window.clearTimeout(scannerBufferTimeoutRef.current);
      }
      scannerBufferTimeoutRef.current = window.setTimeout(() => {
        scannerBufferRef.current = '';
        scannerBufferTimeoutRef.current = null;
      }, SCANNER_BUFFER_TIMEOUT_MS);
    };

    window.addEventListener('keydown', onGlobalBarCodeKeyDown);
    return () => {
      window.removeEventListener('keydown', onGlobalBarCodeKeyDown);
      clearBuffer();
    };
  }, [activeTab, handleScanCode]);

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
      await loadPosProducts();
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
    const requestId = ++salesRequestIdRef.current;
    setSalesLoading(true);
    setSalesError(null);
    try {
      const response = await http.sales.list({
        page: salesPage,
        limit: SALES_PAGE_SIZE,
        from: salesFrom,
        to: salesTo,
        sortBy: 'saleDate',
        sortOrder: 'desc',
      });
      if (requestId !== salesRequestIdRef.current) return;
      setSales(response.items);
      setSalesTotal(response.pagination.total);
      setSalesTotalPages(response.pagination.totalPages);
    } catch (err) {
      if (requestId !== salesRequestIdRef.current) return;
      setSalesError(getApiErrorMessage(err, 'No se pudo cargar el historial de ventas.'));
    } finally {
      if (requestId === salesRequestIdRef.current) {
        setSalesLoading(false);
      }
    }
  }, [salesPage, salesFrom, salesTo]);

  const loadMetrics = useCallback(async () => {
    const requestId = ++metricsRequestIdRef.current;
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const response = await http.sales.getMetrics(salesFrom, salesTo, 'day');
      if (requestId !== metricsRequestIdRef.current) return;
      setMetrics(response.series);
    } catch (err) {
      if (requestId !== metricsRequestIdRef.current) return;
      setMetricsError(getApiErrorMessage(err, 'No se pudieron cargar las métricas.'));
    } finally {
      if (requestId === metricsRequestIdRef.current) {
        setMetricsLoading(false);
      }
    }
  }, [salesFrom, salesTo]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    void loadSales();
    void loadMetrics();
  }, [activeTab, loadSales, loadMetrics]);

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
    setEditLoadingId(sale.id);
    try {
      const full = await http.sales.getOne(sale.id);
      setEditingSale(full);
      setEditOpen(true);
      setEditReplaceItem(null);
      setEditProductSearch('');
      setEditProducts([]);
    } catch {
      sileo.error({ title: 'Error al cargar venta' });
    } finally {
      setEditLoadingId(null);
    }
  };

  const loadPaymentProof = async (saleId: string) => {
    setPaymentProofLoading(prev => ({ ...prev, [saleId]: true }));
    try {
      const response = await http.sales.getPaymentProof(saleId);
      if (response.data && response.data.url) {
        setPaymentProofUrl(response.data.url);
        setPaymentProofOpen(true);
      } else {
        throw new Error('URL no encontrada');
      }
    } catch {
      sileo.error({ title: 'Error al cargar comprobante' });
    } finally {
      setPaymentProofLoading(prev => ({ ...prev, [saleId]: false }));
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
      await loadPosProducts();
    } catch {
      sileo.error({ title: 'Error al eliminar' });
    }
  };

  const posCartTotal = posCart?.items?.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  ) ?? 0;
  const posCartItemsCount = posCart?.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const availablePosProducts = posProducts.filter((p) => (p.stock ?? 0) > 0);

  const renderPosCartContent = (showTitle: boolean) => (
    <>
      {showTitle && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Carrito</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handlePosClearCart()}
            disabled={!posCart?.items?.length || posClearingCart || posCartLoading}
            className="h-8 px-2 text-xs"
          >
            {posClearingCart ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Limpiando...
              </>
            ) : 'Limpiar'}
          </Button>
        </div>
      )}
      {posCartLoading && (
        <div className="mb-2 text-xs text-muted-foreground inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Actualizando carrito...
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
        {posCart?.items?.length ? (
          posCart.items.map((i) => (
            <div
              key={i.productId}
              className="flex items-center justify-between gap-2 text-sm border-b pb-2"
            >
              <span className="truncate flex-1">{capitalizeName(i.product.name)}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => void handlePosChangeItemQuantity(i.productId, -1)}
                  disabled={posCartLoading}
                  aria-label="Disminuir cantidad"
                >
                  {posItemUpdating?.productId === i.productId && posItemUpdating.action === 'dec' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                </Button>
                <span className="w-6 text-center">x{i.quantity}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => void handlePosChangeItemQuantity(i.productId, 1)}
                  disabled={posCartLoading}
                  aria-label="Aumentar cantidad"
                >
                  {posItemUpdating?.productId === i.productId && posItemUpdating.action === 'inc' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <span>${(i.product.price * i.quantity).toLocaleString()}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handlePosRemoveItem(i.productId)}
                disabled={posCartLoading}
              >
                {posRemovingProductId === i.productId || (posItemUpdating?.productId === i.productId && posItemUpdating.action === 'remove') ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
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
    </>
  );

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
            <Eye className="h-4 w-4" /> Historial y Ventas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pos" className="mt-6">
          <div className="relative">
            <div className="min-w-0 xl:pr-[22rem]">
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
                      disabled={posBarCodeSearching}
                    />
                  </div>
                  <Button type="submit" variant="secondary" disabled={posBarCodeSearching}>
                    {posBarCodeSearching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                      </>
                    ) : 'Buscar'}
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

              {posError && (
                <div className="mb-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                  {posError}
                </div>
              )}
              {posLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="animate-pulse h-32 rounded-lg bg-muted" />
                  ))}
                </div>
              ) : availablePosProducts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No hay productos con stock disponible.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {availablePosProducts.map((p) => {
                    const img = p.image || (p as { images?: string[] }).images?.[0];
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePosAddProduct(p, 1)}
                        disabled={posCartLoading}
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
                        {posAddingProductId === p.id && (
                          <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Agregando...
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {availablePosProducts.length} con stock en esta página · {posTotal} total filtrados
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

            <div className="hidden xl:flex w-80 fixed right-6 top-24 border rounded-xl bg-card p-4 flex-col max-h-[calc(100vh-7rem)] shadow-sm">
              {renderPosCartContent(true)}
            </div>
          </div>

          <Button
            type="button"
            className="xl:hidden fixed right-4 bottom-6 z-40 rounded-full shadow-lg px-4"
            onClick={() => setPosCartModalOpen(true)}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Carrito ({posCartItemsCount}) · ${posCartTotal.toLocaleString()}
          </Button>

          <Dialog open={posCartModalOpen} onOpenChange={setPosCartModalOpen}>
            <DialogContent className="w-[95vw] max-w-md max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader className="pb-1">
                <DialogTitle>Carrito</DialogTitle>
              </DialogHeader>
              <div className="mb-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handlePosClearCart()}
                  disabled={!posCart?.items?.length || posClearingCart || posCartLoading}
                  className="h-8 px-2 text-xs"
                >
                  {posClearingCart ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Limpiando...
                    </>
                  ) : 'Limpiar'}
                </Button>
              </div>
              {renderPosCartContent(false)}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={salesFrom}
                onChange={(e) => {
                  setSalesFrom(e.target.value);
                  setSalesPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={salesTo}
                onChange={(e) => {
                  setSalesTo(e.target.value);
                  setSalesPage(1);
                }}
              />
            </div>
          </div>

          {metricsError && (
            <div className="mb-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              {metricsError}
            </div>
          )}

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

          {salesError && (
            <div className="mb-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              {salesError}
            </div>
          )}
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
                    <TableHead>Comprador</TableHead>
                    <TableHead>Origen</TableHead>
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
                      <TableCell>
                        {s.order?.user?.name || s.order?.guestName || s.order?.user?.email || s.order?.guestEmail ? (
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {s.order?.user?.name || s.order?.guestName || 'Sin nombre'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {s.order?.user?.email || s.order?.guestEmail}
                            </span>
                          </div>
                        ) : s.orderItemId ? (
                          <span className="text-muted-foreground text-sm">Venta de caja</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Sin datos</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.orderId ? 'default' : 'secondary'}>
                          {s.orderId ? 'Web' : 'POS'}
                        </Badge>
                      </TableCell>
                      <TableCell>${s.total.toLocaleString()}</TableCell>
                      <TableCell>
                        {PAYMENT_PROVIDERS.find((p) => p.value === s.paymentProvider)?.label ?? s.paymentProvider}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PAYMENT_STATUS_COLORS[s.status] ?? 'default'}>
                          {PAYMENT_STATUS_LABELS[s.status] ?? s.status}
                        </Badge>
                      </TableCell>
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
                          disabled={editLoadingId === s.id}
                          aria-label="Editar venta"
                        >
                          {editLoadingId === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle>Detalle de venta</DialogTitle>
              {selectedSale && (
                <Badge variant={PAYMENT_STATUS_COLORS[selectedSale.status] ?? 'default'}>
                  {PAYMENT_STATUS_LABELS[selectedSale.status] ?? selectedSale.status}
                </Badge>
              )}
            </div>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-6">
              {/* Tipo de venta */}
              <div className="flex items-center gap-2">
                <Badge variant={selectedSale.orderId ? 'default' : 'secondary'} className="text-sm">
                  {selectedSale.orderId ? 'Venta Web' : 'Venta de caja (POS)'}
                </Badge>
                {selectedSale.paymentProofImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => loadPaymentProof(selectedSale.id)}
                    disabled={paymentProofLoading[selectedSale.id]}
                  >
                    {paymentProofLoading[selectedSale.id] ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Eye className="h-3 w-3 mr-1" />
                    )}
                    Ver comprobante
                  </Button>
                )}
              </div>

              <Separator />

              {/* Información del comprador */}
              <div>
                <h4 className="text-sm font-medium mb-3">Información del comprador</h4>
                {selectedSale.order ? (
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(selectedSale.order.user?.name || selectedSale.order.guestName || 'C')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      {selectedSale.order.user ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {selectedSale.order.user.name || 'Sin nombre'}
                            </span>
                            <Badge variant="default" className="text-xs">Cliente registrado</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{selectedSale.order.user.email}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Cliente desde: {dayjs(selectedSale.order.user.createdAt).format('DD/MM/YYYY')}</span>
                            <span>·</span>
                            <span>{selectedSale.order.user.totalOrders} compras en total</span>
                            {selectedSale.order.user.totalOrders === 1 && (
                              <Badge variant="outline" className="text-xs">Primera compra</Badge>
                            )}
                          </div>
                        </>
                      ) : selectedSale.order.guestName || selectedSale.order.guestEmail ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {selectedSale.order.guestName || 'Invitado'}
                            </span>
                            <Badge variant="secondary" className="text-xs">Invitado</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{selectedSale.order.guestEmail}</p>
                          {selectedSale.order.guestPhone && (
                            <p className="text-sm text-muted-foreground">Tel: {selectedSale.order.guestPhone}</p>
                          )}
                          <p className="text-xs text-muted-foreground">Sin cuenta registrada</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin información del comprador</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        <ShoppingCart className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">Venta de caja</p>
                      <p className="text-sm text-muted-foreground">Sin comprador asociado</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Detalles de pago */}
              <div>
                <h4 className="text-sm font-medium mb-3">Detalles de pago</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Método</p>
                    <p className="font-medium">
                      {PAYMENT_PROVIDERS.find((p) => p.value === selectedSale.paymentProvider)?.label ??
                        selectedSale.paymentProvider}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estado</p>
                    <p className="font-medium">
                      {PAYMENT_STATUS_LABELS[selectedSale.status] ?? selectedSale.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Moneda</p>
                    <p className="font-medium">{selectedSale.currency}</p>
                  </div>
                  {selectedSale.discount > 0 && (
                    <div>
                      <p className="text-muted-foreground">Descuento</p>
                      <p className="font-medium text-green-600">-${selectedSale.discount.toLocaleString()}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">${selectedSale.total.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Items */}
              <div>
                <h4 className="text-sm font-medium mb-3">Productos</h4>
                <div className="space-y-2">
                  {selectedSale.order?.items?.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      {item.product.image ? (
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="h-12 w-12 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          x{item.quantity} · ${item.unitPrice.toLocaleString()} c/u
                        </p>
                      </div>
                      <p className="font-medium">${(item.unitPrice * item.quantity).toLocaleString()}</p>
                    </div>
                  ))}
                  {selectedSale.orderItem && (
                    <div key={selectedSale.orderItem.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      {selectedSale.orderItem.product.image ? (
                        <img
                          src={selectedSale.orderItem.product.image}
                          alt={selectedSale.orderItem.product.name}
                          className="h-12 w-12 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{selectedSale.orderItem.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          x{selectedSale.orderItem.quantity} · ${selectedSale.orderItem.unitPrice.toLocaleString()} c/u
                        </p>
                      </div>
                      <p className="font-medium">
                        ${(selectedSale.orderItem.unitPrice * selectedSale.orderItem.quantity).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Fecha de venta</p>
                  <p className="font-medium">{formatDate(selectedSale.saleDate)}</p>
                </div>
                {selectedSale.order?.createdAt && (
                  <div>
                    <p className="text-muted-foreground">Fecha de orden</p>
                    <p className="font-medium">{formatDate(selectedSale.order.createdAt)}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  Cerrar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDetailOpen(false);
                    void handleDeleteSale(selectedSale.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar venta
                </Button>
              </DialogFooter>
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

      {/* Modal para ver comprobante de pago */}
      <Dialog open={paymentProofOpen} onOpenChange={setPaymentProofOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comprobante de pago</DialogTitle>
          </DialogHeader>
          {paymentProofUrl ? (
            <div className="space-y-4">
              <div className="rounded-lg border overflow-hidden bg-muted">
                <img
                  src={paymentProofUrl}
                  alt="Comprobante de pago"
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentProofOpen(false)}>
                  Cerrar
                </Button>
                <Button asChild>
                  <a href={paymentProofUrl} target="_blank" rel="noopener noreferrer">
                    Abrir en nueva pestaña
                  </a>
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
              <p>Cargando comprobante...</p>
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
