import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sileo } from 'sileo';
import { Store, Upload } from 'lucide-react';
import type { Tenant } from '@/types';
import type { ApiError } from '@/services/api';

export default function BusinessPage() {
  const [form, setForm] = useState({
    name: '', logo: '', banner: '', favicon: '',
    facebook: '', instagram: '', whatsapp: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<Tenant>('/admin/business').then((data) => {
      setForm({
        name: data.name || '',
        logo: data.logo || '',
        banner: data.banner || '',
        favicon: data.favicon || '',
        facebook: data.socialLinks?.facebook || '',
        instagram: data.socialLinks?.instagram || '',
        whatsapp: data.socialLinks?.whatsapp || '',
      });
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await api.patch('/admin/business', {
        name: form.name,
        logo: form.logo,
        banner: form.banner,
        favicon: form.favicon,
        socialLinks: { facebook: form.facebook, instagram: form.instagram, whatsapp: form.whatsapp },
      });
      sileo.success({ title: 'Negocio actualizado' });
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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mi Negocio</h2>
        <p className="text-muted-foreground text-sm mt-1">Configurá la información de tu tienda</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6 space-y-5">
        <div className="space-y-2">
          <Label>Nombre del negocio</Label>
          <Input value={form.name} onChange={handleChange('name')} placeholder="Mi Tienda" />
          {errors.name && <p className="text-xs text-primary">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label>URL del Logo</Label>
          <Input value={form.logo} onChange={handleChange('logo')} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <Label>URL del Banner</Label>
          <Input value={form.banner} onChange={handleChange('banner')} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <Label>URL del Favicon</Label>
          <Input value={form.favicon} onChange={handleChange('favicon')} placeholder="https://..." />
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

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </form>
    </div>
  );
}
