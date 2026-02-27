import React, { useState, useEffect, useRef } from 'react';
import { http } from '@/services/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    logo: '', banner: '', favicon: '',
    facebook: '', instagram: '', whatsapp: '',
    bankOptions: [],
  });
  const [previews, setPreviews] = useState<BusinessPreviewsState>({ logo: '', banner: '', favicon: '' });
  const [initial, setInitial] = useState<typeof form | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef(previews);

  useEffect(() => {
    http.business.getAdminBusiness().then((data) => {
      const next = {
        logo: data.logo || '',
        banner: data.banner || '',
        favicon: data.favicon || '',
        facebook: data.socialLinks?.facebook || '',
        instagram: data.socialLinks?.instagram || '',
        whatsapp: data.socialLinks?.whatsapp || '',
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
      if (logoFile) {
        formData.append('logo', logoFile);
        hasChanges = true;
      }
      if (bannerFile) {
        formData.append('banner', bannerFile);
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
        favicon: data.favicon || '',
        facebook: data.socialLinks?.facebook || '',
        instagram: data.socialLinks?.instagram || '',
        whatsapp: data.socialLinks?.whatsapp || '',
        bankOptions: Array.isArray(data.bankOptions) ? data.bankOptions : [],
      };
      setForm(next);
      setInitial(next);
      setPreviews({ logo: '', banner: '', favicon: '' });
      if (logoRef.current) logoRef.current.value = '';
      if (bannerRef.current) bannerRef.current.value = '';
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

  const handleChange = (field: keyof Pick<BusinessFormState, 'facebook' | 'instagram' | 'whatsapp'>) => (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleFileChange = (field: 'logo' | 'banner' | 'favicon') => (e: React.ChangeEvent<HTMLInputElement>) => {
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
  const faviconSrc = previews.favicon || form.favicon;

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
    </div>
  );
}
