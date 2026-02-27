import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sileo } from 'sileo';
import type { Tenant } from '@/types';
import type { ApiError } from '@/services/api';

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

export default function BusinessPage() {
  const [form, setForm] = useState({
    logo: '', banner: '', favicon: '',
    facebook: '', instagram: '', whatsapp: '',
  });
  const [previews, setPreviews] = useState({ logo: '', banner: '', favicon: '' });
  const [initial, setInitial] = useState<typeof form | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef(previews);

  useEffect(() => {
    api.get<Tenant>('/admin/business').then((data) => {
      const next = {
        logo: data.logo || '',
        banner: data.banner || '',
        favicon: data.favicon || '',
        facebook: data.socialLinks?.facebook || '',
        instagram: data.socialLinks?.instagram || '',
        whatsapp: data.socialLinks?.whatsapp || '',
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
      const logoFile = logoRef.current?.files?.[0];
      const bannerFile = bannerRef.current?.files?.[0];
      const faviconFile = faviconRef.current?.files?.[0];

      let hasChanges = false;
      if (initial && JSON.stringify(socialArr) !== JSON.stringify(toSocialMediaArray(initial.facebook, initial.instagram, initial.whatsapp))) {
        formData.append('socialMedia', JSON.stringify(socialArr));
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

      await api.putMultipart('/admin/business/manage', formData);
      sileo.success({ title: 'Negocio actualizado' });
      const data = await api.get<Tenant>('/admin/business');
      const next = {
        logo: data.logo || '',
        banner: data.banner || '',
        favicon: data.favicon || '',
        facebook: data.socialLinks?.facebook || '',
        instagram: data.socialLinks?.instagram || '',
        whatsapp: data.socialLinks?.whatsapp || '',
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
        const fieldErrors: Record<string, string> = {};
        Object.entries(apiErr.errors).forEach(([k, v]) => { fieldErrors[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(fieldErrors);
      } else {
        sileo.error({ title: 'Error al guardar' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mi Negocio</h2>
        <p className="text-muted-foreground text-sm mt-1">Configurá la información de tu tienda</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6 space-y-5">
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="mb-2 rounded-lg border bg-muted/30 p-3">
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
          <div className="mb-2 rounded-lg border bg-muted/30 p-3">
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
          <div className="mb-2 rounded-lg border bg-muted/30 p-3">
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

        <div className="border-t pt-5 space-y-4">
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

        {Object.keys(errors).length > 0 && (
          <p className="text-xs text-primary">Revisá los campos con error.</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </form>
    </div>
  );
}
