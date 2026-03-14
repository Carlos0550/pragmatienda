import React, { useState, useEffect, useRef } from 'react';
import { http } from '@/services/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { sileo } from 'sileo';
import { toFormErrors } from '@/lib/api-utils';
import { getStoreBaseUrl, normalizeStoreSubdomain } from '@/lib/storefront';
import type { ApiError, BankOption, BannerOverlayPosition, BusinessBanner, BusinessFormState, BusinessPreviewsState, FormErrors, Tenant } from '@/types';
import { Landmark, Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const GRID_VALUES = [0, 25, 50, 75, 100];

function BannerPositionGrid({
  src,
  objectPositionX,
  objectPositionY,
  onSelect,
}: {
  src: string;
  objectPositionX: number;
  objectPositionY: number;
  onSelect: (x: number, y: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative w-16 h-10 rounded border overflow-hidden bg-muted/30 flex-shrink-0"
        title="Vista previa con posición actual"
      >
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          style={{ objectPosition: `${objectPositionX}% ${objectPositionY}%` }}
        />
      </div>
      <div className="grid grid-cols-5 gap-0.5 w-[70px]">
        {GRID_VALUES.map((yVal) =>
          GRID_VALUES.map((xVal) => (
            <button
              key={`${xVal}-${yVal}`}
              type="button"
              onClick={() => onSelect(xVal, yVal)}
              className={`w-3 h-3 rounded-sm border transition-colors ${
                objectPositionX === xVal && objectPositionY === yVal
                  ? 'bg-primary border-primary'
                  : 'bg-muted/50 border-muted-foreground/30 hover:bg-muted'
              }`}
              title={`${xVal}%, ${yVal}%`}
              aria-label={`Posición ${xVal}% ${yVal}%`}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Previsualización que respeta el formato de la imagen (sin recortar). */
function AssetPreview({
  src,
  alt,
  variant = 'wide',
}: {
  src: string;
  alt: string;
  variant?: 'square' | 'wide';
}) {
  const isSquare = variant === 'square';
  return (
    <div
      className={
        isSquare
          ? 'flex items-center justify-center rounded-lg border bg-muted/30 p-3 min-h-[100px] min-w-[100px] max-w-[140px]'
          : 'rounded-lg border bg-muted/30 p-3 min-h-[100px] w-full max-w-md'
      }
    >
      <img
        src={src}
        alt={alt}
        className={
          isSquare
            ? 'max-h-20 max-w-20 w-auto h-auto object-contain rounded'
            : 'max-h-32 w-full h-auto object-contain rounded'
        }
      />
    </div>
  );
}

function toSocialMediaArray(facebook: string, instagram: string, whatsapp: string): { name: string; url: string }[] {
  const arr: { name: string; url: string }[] = [];
  if (facebook?.trim()) arr.push({ name: 'facebook', url: facebook.trim() });
  if (instagram?.trim()) arr.push({ name: 'instagram', url: instagram.trim() });
  if (whatsapp?.trim()) {
    const w = whatsapp.trim();
    arr.push({ name: 'whatsapp', url: /^https?:\/\//i.test(w) ? w : `https://wa.me/${w.replace(/\D/g, '')}` });
  }
  return arr;
}

function normalizeBankOptions(bankOptions: BankOption[]) {
  let hasPartial = false;
  const items = bankOptions.reduce<BankOption[]>((acc, option) => {
    const bankName = option.bankName.trim();
    const recipientName = option.recipientName.trim();
    const aliasCvuCbu = option.aliasCvuCbu.trim();
    const isEmpty = !bankName && !recipientName && !aliasCvuCbu;

    if (isEmpty) return acc;
    if (!bankName || !recipientName || !aliasCvuCbu) {
      hasPartial = true;
      return acc;
    }

    acc.push({ bankName, recipientName, aliasCvuCbu });
    return acc;
  }, []);

  return { items, hasPartial };
}

function toBusinessFormState(data: Tenant): BusinessFormState {
  return {
    name: data.name || '',
    website: data.website || '',
    storeUrl: data.storeUrl || (data.website ? getStoreBaseUrl(data.website) : ''),
    logo: data.logo || '',
    banner: data.banner || '',
    seoImage: data.seoImage || '',
    favicon: data.favicon || '',
    address: data.address || '',
    province: data.province || '',
    seoDescription: data.seoDescription || '',
    facebook: data.socialLinks?.facebook || '',
    instagram: data.socialLinks?.instagram || '',
    whatsapp: data.socialLinks?.whatsapp || '',
    banners: Array.isArray(data.banners)
      ? data.banners.map((b) => ({
          url: b.url,
          order: b.order ?? 0,
          objectPositionX: b.objectPositionX ?? 50,
          objectPositionY: b.objectPositionY ?? 50,
        }))
      : [],
    bankOptions: Array.isArray(data.bankOptions) ? data.bankOptions : [],
    bannerOverlayPosition: (data.bannerOverlayPosition ?? '') as BannerOverlayPosition | '',
  };
}

export default function BusinessPage() {
  const [form, setForm] = useState<BusinessFormState>({
    name: '', website: '', storeUrl: '',
    logo: '', banner: '', seoImage: '', favicon: '',
    address: '', province: '', seoDescription: '',
    facebook: '', instagram: '', whatsapp: '',
    banners: [],
    bankOptions: [],
    bannerOverlayPosition: '',
  });
  const [previews, setPreviews] = useState<BusinessPreviewsState>({
    logo: '', banner: '', seoImage: '', favicon: ''
  });
  const [clearingAsset, setClearingAsset] = useState<'logo' | 'favicon' | 'seoImage' | null>(null);
  const [initial, setInitial] = useState<typeof form | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const [seoAssistantLoading, setSeoAssistantLoading] = useState(false);
  const [seoAssistant, setSeoAssistant] = useState({
    businessSummary: '',
    offerAndDifferential: '',
    shipsNationwide: false,
    hasPhysicalStore: false,
    physicalStoreLocation: '',
  });
  const [pendingBannerFiles, setPendingBannerFiles] = useState<File[]>([]);
  const [pendingBannerPreviews, setPendingBannerPreviews] = useState<string[]>([]);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannersRef = useRef<HTMLInputElement>(null);
  const seoImageRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef(previews);

  useEffect(() => {
    http.business.getAdminBusiness().then((data) => {
      const next = toBusinessFormState(data);
      setForm(next);
      setInitial(next);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const pendingPreviewsRef = useRef<string[]>([]);
  pendingPreviewsRef.current = pendingBannerPreviews;
  useEffect(() => {
    return () => {
      pendingPreviewsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const formData = new FormData();
      const socialArr = toSocialMediaArray(form.facebook, form.instagram, form.whatsapp);
      const normalizedBankOptions = normalizeBankOptions(form.bankOptions);
      const logoFile = logoRef.current?.files?.[0];
      const seoImageFile = seoImageRef.current?.files?.[0];
      const faviconFile = faviconRef.current?.files?.[0];

      if (normalizedBankOptions.hasPartial) {
        sileo.error({ title: 'Completá todos los campos de la transferencia o eliminá la fila incompleta.' });
        setLoading(false);
        return;
      }

      let hasChanges = false;
      const initialSocial = toSocialMediaArray(
        initial?.facebook ?? '',
        initial?.instagram ?? '',
        initial?.whatsapp ?? ''
      );
      if (JSON.stringify(socialArr) !== JSON.stringify(initialSocial)) {
        formData.append('socialMedia', JSON.stringify(socialArr));
        hasChanges = true;
      }
      const initialNormalized = normalizeBankOptions(initial?.bankOptions ?? []).items;
      if (JSON.stringify(normalizedBankOptions.items) !== JSON.stringify(initialNormalized)) {
        formData.append('bankOptions', JSON.stringify(normalizedBankOptions.items));
        hasChanges = true;
      }
      if (form.address.trim() !== (initial?.address ?? '').trim()) {
        formData.append('address', form.address.trim());
        hasChanges = true;
      }
      if (form.name.trim() !== (initial?.name ?? '').trim()) {
        formData.append('name', form.name.trim());
        hasChanges = true;
      }
      if (normalizeStoreSubdomain(form.website) !== normalizeStoreSubdomain(initial?.website ?? '')) {
        formData.append('website', form.website.trim());
        hasChanges = true;
      }
      if (form.province.trim() !== (initial?.province ?? '').trim()) {
        formData.append('province', form.province.trim());
        hasChanges = true;
      }
      if (form.seoDescription.trim() !== (initial?.seoDescription ?? '').trim()) {
        formData.append('seoDescription', form.seoDescription.trim());
        hasChanges = true;
      }
      const currentBannerData = form.banners.map((b, i) => ({
        url: b.url,
        order: i,
        objectPositionX: b.objectPositionX ?? 50,
        objectPositionY: b.objectPositionY ?? 50,
      }));
      const initialBannerData = (initial?.banners ?? []).map((b, i) => ({
        url: b.url,
        order: i,
        objectPositionX: b.objectPositionX ?? 50,
        objectPositionY: b.objectPositionY ?? 50,
      }));
      const bannersChanged =
        JSON.stringify(currentBannerData) !== JSON.stringify(initialBannerData) ||
        pendingBannerFiles.length > 0;
      if (bannersChanged) {
        formData.append('bannerData', JSON.stringify(currentBannerData));
        pendingBannerFiles.forEach((file) => formData.append('banners', file));
        hasChanges = true;
      }
      if (form.bannerOverlayPosition !== (initial?.bannerOverlayPosition ?? '')) {
        formData.append('bannerOverlayPosition', form.bannerOverlayPosition || 'bottom-left');
        hasChanges = true;
      }
      if (logoFile) {
        formData.append('logo', logoFile);
        hasChanges = true;
      }
      if (seoImageFile) {
        formData.append('seoImage', seoImageFile);
        hasChanges = true;
      }
      if (faviconFile) {
        formData.append('favicon', faviconFile);
        hasChanges = true;
      }

      if (!hasChanges) {
        sileo.info({ title: 'Sin cambios. No hay modificaciones para guardar.' });
        setLoading(false);
        return;
      }

      await http.business.updateAdminBusiness(formData);
      sileo.success({ title: 'Negocio actualizado' });
      const data = await http.business.getAdminBusiness();
      const next = toBusinessFormState(data);
      setForm(next);
      setInitial(next);
      setPreviews({ logo: '', banner: '', seoImage: '', favicon: '' });
      setPendingBannerFiles([]);
      setPendingBannerPreviews((prev) => {
        prev.forEach((url) => URL.revokeObjectURL(url));
        return [];
      });
      if (logoRef.current) logoRef.current.value = '';
      if (bannersRef.current) bannersRef.current.value = '';
      if (seoImageRef.current) seoImageRef.current.value = '';
      if (faviconRef.current) faviconRef.current.value = '';
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        setErrors(toFormErrors(apiErr.errors));
      } else if (apiErr.message?.toLowerCase().includes('subdominio')) {
        setErrors((prev) => ({ ...prev, website: apiErr.message || 'El subdominio ya está en uso' }));
      } else {
        sileo.error({ title: 'Error al guardar' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Pick<BusinessFormState, 'name' | 'website' | 'facebook' | 'instagram' | 'whatsapp' | 'address' | 'province' | 'seoDescription'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const addBankOption = () => {
    setForm((prev) => ({
      ...prev,
      bankOptions: [...prev.bankOptions, { bankName: '', recipientName: '', aliasCvuCbu: '' }],
    }));
  };

  const removeBankOption = (index: number) => {
    setForm((prev) => ({
      ...prev,
      bankOptions: prev.bankOptions.filter((_, i) => i !== index),
    }));
  };

  const updateBankOption = (index: number, field: keyof BankOption, value: string) => {
    setForm((prev) => ({
      ...prev,
      bankOptions: prev.bankOptions.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const removeCarouselBanner = (index: number) => {
    setForm((prev) => ({
      ...prev,
      banners: prev.banners.filter((_, i) => i !== index),
    }));
  };

  const updateBannerPosition = (index: number, x: number, y: number) => {
    setForm((prev) => ({
      ...prev,
      banners: prev.banners.map((b, i) =>
        i === index ? { ...b, objectPositionX: x, objectPositionY: y } : b
      ),
    }));
  };

  const removePendingBanner = (index: number) => {
    setPendingBannerPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
    setPendingBannerFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddBanners = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPendingBannerFiles((prev) => [...prev, ...files]);
    setPendingBannerPreviews((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f)),
    ]);
    e.target.value = '';
  };

  const handleFileChange = (field: 'logo' | 'banner' | 'seoImage' | 'favicon') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPreviews((prev) => {
      const next = { ...prev };
      if (next[field]) URL.revokeObjectURL(next[field]);
      next[field] = file ? URL.createObjectURL(file) : '';
      return next;
    });
  };

  const logoSrc = previews.logo || form.logo;
  const seoImageSrc = previews.seoImage || form.seoImage;
  const faviconSrc = previews.favicon || form.favicon;
  const storeUrlPreview = form.website.trim() ? getStoreBaseUrl(form.website) : form.storeUrl;

  const handleClearAsset = async (asset: 'logo' | 'favicon' | 'seoImage') => {
    const flag = asset === 'logo' ? 'clearLogo' : asset === 'favicon' ? 'clearFavicon' : 'clearSeoImage';
    setClearingAsset(asset);
    try {
      const formData = new FormData();
      formData.append(flag, 'true');
      await http.business.updateAdminBusiness(formData);
      sileo.success({ title: 'Imagen eliminada' });
      const data = await http.business.getAdminBusiness();
      const next = toBusinessFormState(data);
      setForm(next);
      setInitial(next);
      setPreviews((p) => {
        const url = p[asset];
        if (url) URL.revokeObjectURL(url);
        return { ...p, [asset]: '' };
      });
      const ref = asset === 'logo' ? logoRef : asset === 'favicon' ? faviconRef : seoImageRef;
      if (ref.current) ref.current.value = '';
    } catch (err) {
      const apiErr = err as ApiError;
      sileo.error({ title: apiErr.message || 'No se pudo eliminar la imagen' });
    } finally {
      setClearingAsset(null);
    }
  };

  const handleImproveSeoWithIa = async () => {
    try {
      setSeoAssistantLoading(true);
      const payload = {
        currentText: form.seoDescription.trim() || undefined,
        businessSummary: seoAssistant.businessSummary.trim() || undefined,
        businessDetails: seoAssistant.offerAndDifferential.trim() || undefined,
        productsOrServices: seoAssistant.offerAndDifferential.trim() || undefined,
        shipsNationwide: seoAssistant.shipsNationwide,
        hasPhysicalStore: seoAssistant.hasPhysicalStore,
        physicalStoreLocation:
          seoAssistant.hasPhysicalStore && seoAssistant.physicalStoreLocation.trim()
            ? seoAssistant.physicalStoreLocation.trim()
            : undefined,
      };
      const result = await http.business.improveSeoDescription(payload);
      setForm((prev) => ({
        ...prev,
        seoDescription: result.data.seoDescription || prev.seoDescription,
      }));
      setSeoModalOpen(false);
      sileo.success({ title: 'Descripción SEO mejorada con IA' });
    } catch (err) {
      const apiErr = err as ApiError;
      sileo.error({ title: apiErr.message || 'No se pudo mejorar con IA' });
    } finally {
      setSeoAssistantLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mi Negocio</h2>
        <p className="text-muted-foreground text-sm mt-1">Configurá la información de tu tienda</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6 space-y-6">
        <section className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Identidad y dominio</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business-name">Nombre visible</Label>
              <Input
                id="business-name"
                value={form.name}
                onChange={handleChange('name')}
                placeholder="Mi Tienda"
              />
              {errors.name && <p className="text-xs text-primary">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-website">Subdominio</Label>
              <Input
                id="business-website"
                value={form.website}
                onChange={handleChange('website')}
                placeholder="mi-tienda"
              />
              <p className="text-xs text-muted-foreground">
                URL pública: <span className="font-medium text-foreground">{storeUrlPreview || 'Sin subdominio configurado'}</span>
              </p>
              {errors.website && <p className="text-xs text-primary">{errors.website}</p>}
            </div>
          </div>
        </section>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Imagen e identidad</h3>
              <p className="text-sm text-muted-foreground">
                Logo, favicon e imagen para redes y compartidos (SEO).
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  {logoSrc ? (
                    <AssetPreview src={logoSrc} alt="Logo" variant="square" />
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 min-h-[100px]">
                      <p className="text-xs text-muted-foreground">Sin logo</p>
                    </div>
                  )}
                  {previews.logo && <p className="text-[11px] text-muted-foreground">Nuevo archivo seleccionado</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      ref={logoRef}
                      type="file"
                      accept="image/*"
                      className="cursor-pointer max-w-[200px]"
                      onChange={handleFileChange('logo')}
                    />
                    {form.logo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClearAsset('logo')}
                        disabled={clearingAsset === 'logo'}
                        className="gap-1"
                      >
                        <Trash2 className="h-4 w-4" /> {clearingAsset === 'logo' ? 'Eliminando...' : 'Eliminar'}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Favicon</Label>
                  {faviconSrc ? (
                    <AssetPreview src={faviconSrc} alt="Favicon" variant="square" />
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 min-h-[100px]">
                      <p className="text-xs text-muted-foreground">Sin favicon</p>
                    </div>
                  )}
                  {previews.favicon && <p className="text-[11px] text-muted-foreground">Nuevo archivo seleccionado</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      ref={faviconRef}
                      type="file"
                      accept="image/*"
                      className="cursor-pointer max-w-[200px]"
                      onChange={handleFileChange('favicon')}
                    />
                    {form.favicon && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClearAsset('favicon')}
                        disabled={clearingAsset === 'favicon'}
                        className="gap-1"
                      >
                        <Trash2 className="h-4 w-4" /> {clearingAsset === 'favicon' ? 'Eliminando...' : 'Eliminar'}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Imagen SEO (Open Graph / Twitter)</Label>
                  {seoImageSrc ? (
                    <AssetPreview src={seoImageSrc} alt="Imagen SEO" variant="wide" />
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 min-h-[100px]">
                      <p className="text-xs text-muted-foreground">Sin imagen SEO</p>
                    </div>
                  )}
                  {previews.seoImage && <p className="text-[11px] text-muted-foreground">Nuevo archivo seleccionado</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      ref={seoImageRef}
                      type="file"
                      accept="image/*"
                      className="cursor-pointer max-w-[200px]"
                      onChange={handleFileChange('seoImage')}
                    />
                    {form.seoImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClearAsset('seoImage')}
                        disabled={clearingAsset === 'seoImage'}
                        className="gap-1"
                      >
                        <Trash2 className="h-4 w-4" /> {clearingAsset === 'seoImage' ? 'Eliminando...' : 'Eliminar'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Banners del carrusel</h3>
              <p className="text-sm text-muted-foreground">
                Banners secundarios que se muestran en el carrusel. Podés agregar o eliminar.
              </p>
              <p className="text-xs text-muted-foreground">
                Usá la grilla 5×5 para elegir el punto de anclaje de cada imagen (qué parte se muestra cuando se recorta).
              </p>
              <div className="space-y-2">
                <Label>Posición del texto sobre el banner</Label>
                <Select
                  value={form.bannerOverlayPosition || 'bottom-left'}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, bannerOverlayPosition: v as BannerOverlayPosition }))}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Elegir posición" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-left">Abajo izquierda</SelectItem>
                    <SelectItem value="bottom-center">Abajo centro</SelectItem>
                    <SelectItem value="bottom-right">Abajo derecha</SelectItem>
                    <SelectItem value="top-left">Arriba izquierda</SelectItem>
                    <SelectItem value="top-center">Arriba centro</SelectItem>
                    <SelectItem value="top-right">Arriba derecha</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Elegí dónde aparece el texto de bienvenida para que no se superponga con la imagen.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">Listado de banners</span>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={bannersRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAddBanners}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => bannersRef.current?.click()}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" /> Agregar banner
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Vista previa</TableHead>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Posición X,Y</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.banners.map((banner: BusinessBanner, index: number) => (
                        <TableRow key={`saved-${banner.url}-${index}`}>
                          <TableCell className="p-2">
                            <div className="rounded border bg-muted/30 p-1.5 w-[120px] h-[64px] flex items-center justify-center overflow-hidden">
                              <img
                                src={banner.url}
                                alt={`Banner ${index + 1}`}
                                className="max-h-full max-w-full object-contain"
                                style={{
                                  objectPosition: `${banner.objectPositionX ?? 50}% ${banner.objectPositionY ?? 50}%`,
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell>
                            <BannerPositionGrid
                              src={banner.url}
                              objectPositionX={banner.objectPositionX ?? 50}
                              objectPositionY={banner.objectPositionY ?? 50}
                              onSelect={(x, y) => updateBannerPosition(index, x, y)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCarouselBanner(index)}
                              className="gap-1"
                            >
                              <Trash2 className="h-4 w-4" /> Eliminar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {pendingBannerFiles.map((_, index) => (
                        <TableRow key={`pending-${index}`}>
                          <TableCell className="p-2">
                            <div className="rounded border border-dashed bg-muted/20 p-1.5 w-[120px] h-[64px] flex items-center justify-center overflow-hidden">
                              {pendingBannerPreviews[index] ? (
                                <img
                                  src={pendingBannerPreviews[index]}
                                  alt={`Nuevo ${index + 1}`}
                                  className="max-h-full max-w-full object-contain"
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">…</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{form.banners.length + index + 1}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">Centro (50%, 50%)</TableCell>
                          <TableCell className="text-right">
                            <span className="text-xs text-muted-foreground mr-2">Se guardará al enviar</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePendingBanner(index)}
                              className="gap-1"
                            >
                              <Trash2 className="h-4 w-4" /> Quitar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {form.banners.length === 0 && pendingBannerFiles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            No hay banners. Usá &quot;Agregar&quot; para subir imágenes.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Redes sociales</h3>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={form.address} onChange={handleChange('address')} placeholder="Calle 123" />
              </div>
              <div className="space-y-2">
                <Label>Provincia</Label>
                <Input value={form.province} onChange={handleChange('province')} placeholder="Buenos Aires" />
              </div>
              <div className="space-y-2">
                <Label>SEO description</Label>
                <textarea
                  value={form.seoDescription}
                  onChange={handleChange('seoDescription')}
                  className="w-full min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Descripción breve para metatags y compartidos."
                />
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSeoModalOpen(true)}>
                    Mejorar con IA
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input value={form.facebook} onChange={handleChange('facebook')} placeholder="https://facebook.com/..." />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input value={form.instagram} onChange={handleChange('instagram')} placeholder="https://instagram.com/..." />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={handleChange('whatsapp')} placeholder="+54 9 11 ..." />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Formas de pago</h3>

              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">Transferencia bancaria</p>
                    <p className="text-xs text-muted-foreground">Configurá las cuentas para recibir pagos por transferencia.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addBankOption} className="gap-2">
                    <Plus className="h-4 w-4" /> Agregar cuenta
                  </Button>
                </div>

                {form.bankOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay cuentas bancarias cargadas.</p>
                ) : (
                  <div className="space-y-3">
                    {form.bankOptions.map((option, index) => (
                      <div key={index} className="rounded-md border bg-background p-3 space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <Input
                            value={option.bankName}
                            onChange={(e) => updateBankOption(index, 'bankName', e.target.value)}
                            placeholder="Nombre del banco"
                          />
                          <Input
                            value={option.recipientName}
                            onChange={(e) => updateBankOption(index, 'recipientName', e.target.value)}
                            placeholder="Nombre del destinatario"
                          />
                          <Input
                            value={option.aliasCvuCbu}
                            onChange={(e) => updateBankOption(index, 'aliasCvuCbu', e.target.value)}
                            placeholder="Alias / CVU / CBU"
                          />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeBankOption(index)} className="gap-2">
                          <Trash2 className="h-4 w-4" /> Eliminar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-muted/20 p-4 flex items-start gap-3">
                <div className="rounded-md bg-background p-2">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Mercado Pago</p>
                  <p className="text-xs text-muted-foreground">Próximamente.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {Object.keys(errors).length > 0 && (
          <p className="text-xs text-primary">Revisá los campos con error.</p>
        )}

        <Button type="submit" disabled={loading} className="w-full md:w-auto">
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </form>

      <Dialog open={seoModalOpen} onOpenChange={setSeoModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mejorar descripción SEO con IA</DialogTitle>
            <DialogDescription>
              Contá brevemente sobre tu negocio y vamos a generar una mejor descripción para metatags y compartidos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>¿Qué es tu negocio?</Label>
              <Input
                value={seoAssistant.businessSummary}
                onChange={(e) => setSeoAssistant((prev) => ({ ...prev, businessSummary: e.target.value }))}
                placeholder="Ej: Tienda de indumentaria urbana"
              />
            </div>
            <div className="space-y-1">
              <Label>¿Qué vendés/ofrecés y qué te diferencia?</Label>
              <Input
                value={seoAssistant.offerAndDifferential}
                onChange={(e) => setSeoAssistant((prev) => ({ ...prev, offerAndDifferential: e.target.value }))}
                placeholder="Ej: Joyas, relojes y accesorios; atención personalizada y envíos rápidos"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="shipsNationwide"
                type="checkbox"
                checked={seoAssistant.shipsNationwide}
                onChange={(e) => setSeoAssistant((prev) => ({ ...prev, shipsNationwide: e.target.checked }))}
              />
              <Label htmlFor="shipsNationwide">¿Hacés envíos nacionales?</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="hasPhysicalStore"
                type="checkbox"
                checked={seoAssistant.hasPhysicalStore}
                onChange={(e) => setSeoAssistant((prev) => ({ ...prev, hasPhysicalStore: e.target.checked }))}
              />
              <Label htmlFor="hasPhysicalStore">¿Tenés local físico?</Label>
            </div>
            {seoAssistant.hasPhysicalStore && (
              <div className="space-y-1">
                <Label>¿Dónde queda el local?</Label>
                <Input
                  value={seoAssistant.physicalStoreLocation}
                  onChange={(e) => setSeoAssistant((prev) => ({ ...prev, physicalStoreLocation: e.target.value }))}
                  placeholder="Ej: Posadas, Misiones"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSeoModalOpen(false)} disabled={seoAssistantLoading}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleImproveSeoWithIa} disabled={seoAssistantLoading}>
              {seoAssistantLoading ? 'Generando...' : 'Generar descripción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
