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
import type { ApiError, BankOption, BusinessFormState, BusinessPreviewsState, FormErrors } from '@/types';
import { Landmark, Plus, Trash2 } from 'lucide-react';

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

export default function BusinessPage() {
  const [form, setForm] = useState<BusinessFormState>({
    logo: '', banner: '', mainBanner: '', seoImage: '', favicon: '',
    address: '', province: '', seoDescription: '',
    facebook: '', instagram: '', whatsapp: '',
    banners: [],
    bankOptions: [],
  });
  const [previews, setPreviews] = useState<BusinessPreviewsState>({
    logo: '', banner: '', mainBanner: '', seoImage: '', favicon: ''
  });
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
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const mainBannerRef = useRef<HTMLInputElement>(null);
  const bannersRef = useRef<HTMLInputElement>(null);
  const seoImageRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef(previews);

  useEffect(() => {
    http.business.getAdminBusiness().then((data) => {
      const next = {
        logo: data.logo || '',
        banner: data.banner || '',
        mainBanner: data.mainBanner || data.banner || '',
        seoImage: data.seoImage || '',
        favicon: data.favicon || '',
        address: data.address || '',
        province: data.province || '',
        seoDescription: data.seoDescription || '',
        facebook: data.socialLinks?.facebook || '',
        instagram: data.socialLinks?.instagram || '',
        whatsapp: data.socialLinks?.whatsapp || '',
        banners: Array.isArray(data.banners) ? data.banners : [],
        bankOptions: Array.isArray(data.bankOptions) ? data.bankOptions : [],
      };
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const formData = new FormData();
      const socialArr = toSocialMediaArray(form.facebook, form.instagram, form.whatsapp);
      const normalizedBankOptions = normalizeBankOptions(form.bankOptions);
      const logoFile = logoRef.current?.files?.[0];
      const bannerFile = bannerRef.current?.files?.[0];
      const mainBannerFile = mainBannerRef.current?.files?.[0];
      const bannersFiles = Array.from(bannersRef.current?.files ?? []);
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
      if (form.province.trim() !== (initial?.province ?? '').trim()) {
        formData.append('province', form.province.trim());
        hasChanges = true;
      }
      if (form.seoDescription.trim() !== (initial?.seoDescription ?? '').trim()) {
        formData.append('seoDescription', form.seoDescription.trim());
        hasChanges = true;
      }
      if (logoFile) {
        formData.append('logo', logoFile);
        hasChanges = true;
      }
      if (bannerFile) {
        formData.append('banner', bannerFile);
        hasChanges = true;
      }
      if (mainBannerFile) {
        formData.append('mainBanner', mainBannerFile);
        hasChanges = true;
      }
      if (bannersFiles.length > 0) {
        bannersFiles.forEach((file) => formData.append('banners', file));
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
      const next = {
        logo: data.logo || '',
        banner: data.banner || '',
        mainBanner: data.mainBanner || data.banner || '',
        seoImage: data.seoImage || '',
        favicon: data.favicon || '',
        address: data.address || '',
        province: data.province || '',
        seoDescription: data.seoDescription || '',
        facebook: data.socialLinks?.facebook || '',
        instagram: data.socialLinks?.instagram || '',
        whatsapp: data.socialLinks?.whatsapp || '',
        banners: Array.isArray(data.banners) ? data.banners : [],
        bankOptions: Array.isArray(data.bankOptions) ? data.bankOptions : [],
      };
      setForm(next);
      setInitial(next);
      setPreviews({ logo: '', banner: '', mainBanner: '', seoImage: '', favicon: '' });
      if (logoRef.current) logoRef.current.value = '';
      if (bannerRef.current) bannerRef.current.value = '';
      if (mainBannerRef.current) mainBannerRef.current.value = '';
      if (bannersRef.current) bannersRef.current.value = '';
      if (seoImageRef.current) seoImageRef.current.value = '';
      if (faviconRef.current) faviconRef.current.value = '';
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        setErrors(toFormErrors(apiErr.errors));
      } else {
        sileo.error({ title: 'Error al guardar' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Pick<BusinessFormState, 'facebook' | 'instagram' | 'whatsapp' | 'address' | 'province' | 'seoDescription'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const handleFileChange = (field: 'logo' | 'banner' | 'mainBanner' | 'seoImage' | 'favicon') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPreviews((prev) => {
      const next = { ...prev };
      if (next[field]) URL.revokeObjectURL(next[field]);
      next[field] = file ? URL.createObjectURL(file) : '';
      return next;
    });
  };

  const logoSrc = previews.logo || form.logo;
  const bannerSrc = previews.banner || form.banner;
  const mainBannerSrc = previews.mainBanner || form.mainBanner;
  const seoImageSrc = previews.seoImage || form.seoImage;
  const faviconSrc = previews.favicon || form.favicon;

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
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="mb-2 rounded-lg border bg-muted/30 p-3 min-h-[92px]">
                {logoSrc ? (
                  <img src={logoSrc} alt="Logo actual" className="h-16 w-16 object-contain rounded bg-white" />
                ) : (
                  <p className="text-xs text-muted-foreground">Sin logo cargado</p>
                )}
                {previews.logo && <p className="mt-2 text-[11px] text-muted-foreground">Previsualización</p>}
              </div>
              <Input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={handleFileChange('logo')}
              />
            </div>
            <div className="space-y-2">
              <Label>Banner principal</Label>
              <div className="mb-2 rounded-lg border bg-muted/30 p-3 min-h-[160px]">
                {mainBannerSrc ? (
                  <img src={mainBannerSrc} alt="Banner principal" className="h-28 w-full object-cover rounded" />
                ) : (
                  <p className="text-xs text-muted-foreground">Sin banner principal cargado</p>
                )}
                {previews.mainBanner && <p className="mt-2 text-[11px] text-muted-foreground">Previsualización</p>}
              </div>
              <Input
                ref={mainBannerRef}
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={handleFileChange('mainBanner')}
              />
            </div>
            <div className="space-y-2">
              <Label>Banner</Label>
              <div className="mb-2 rounded-lg border bg-muted/30 p-3 min-h-[160px]">
                {bannerSrc ? (
                  <img src={bannerSrc} alt="Banner actual" className="h-28 w-full object-cover rounded" />
                ) : (
                  <p className="text-xs text-muted-foreground">Sin banner cargado</p>
                )}
                {previews.banner && <p className="mt-2 text-[11px] text-muted-foreground">Previsualización</p>}
              </div>
              <Input
                ref={bannerRef}
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={handleFileChange('banner')}
              />
            </div>
            <div className="space-y-2">
              <Label>Banners secundarios (carousel)</Label>
              <Input
                ref={bannersRef}
                type="file"
                accept="image/*"
                className="cursor-pointer"
                multiple
              />
              {form.banners.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Actualmente hay {form.banners.length} banners secundarios cargados.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Imagen SEO (Open Graph/Twitter)</Label>
              <div className="mb-2 rounded-lg border bg-muted/30 p-3 min-h-[160px]">
                {seoImageSrc ? (
                  <img src={seoImageSrc} alt="Imagen SEO" className="h-28 w-full object-cover rounded" />
                ) : (
                  <p className="text-xs text-muted-foreground">Sin imagen SEO cargada</p>
                )}
                {previews.seoImage && <p className="mt-2 text-[11px] text-muted-foreground">Previsualización</p>}
              </div>
              <Input
                ref={seoImageRef}
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={handleFileChange('seoImage')}
              />
            </div>
            <div className="space-y-2">
              <Label>Favicon</Label>
              <div className="mb-2 rounded-lg border bg-muted/30 p-3 min-h-[72px]">
                {faviconSrc ? (
                  <img src={faviconSrc} alt="Favicon actual" className="h-10 w-10 object-contain rounded bg-white" />
                ) : (
                  <p className="text-xs text-muted-foreground">Sin favicon cargado</p>
                )}
                {previews.favicon && <p className="mt-2 text-[11px] text-muted-foreground">Previsualización</p>}
              </div>
              <Input
                ref={faviconRef}
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={handleFileChange('favicon')}
              />
            </div>
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
