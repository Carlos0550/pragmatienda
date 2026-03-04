import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, User, ChevronRight, ChevronLeft } from 'lucide-react';
import { http } from '@/services/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { sileo } from 'sileo';
import { toFormErrors } from '@/lib/api-utils';
import { capitalizeName } from '@/lib/utils';
import type { ApiError, CreateBusinessPayload, FormErrors } from '@/types';

const STEPS = [
  { id: 1, title: 'Tu negocio', icon: Store },
  { id: 2, title: 'Tu cuenta', icon: User },
] as const;

const initialForm: CreateBusinessPayload = {
  name: '',
  phone: '',
  address: '',
  province: '',
  adminEmail: '',
  adminName: '',
};

export default function AdminRegisterPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const navigate = useNavigate();

  const update = (field: keyof CreateBusinessPayload) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateStep1 = (): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = 'El nombre del negocio es obligatorio';
    else if (form.name.trim().length < 3) next.name = 'Mínimo 3 caracteres';
    if (!form.phone.trim()) next.phone = 'El teléfono es obligatorio';
    else if (form.phone.replace(/\D/g, '').length < 10) next.phone = 'Ingresá un teléfono válido (mín. 10 dígitos)';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = (): boolean => {
    const next: FormErrors = {};
    if (!form.adminName.trim()) next.adminName = 'Tu nombre es obligatorio';
    else if (form.adminName.trim().length < 3) next.adminName = 'Mínimo 3 caracteres';
    if (!form.adminEmail.trim()) next.adminEmail = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) next.adminEmail = 'Email inválido';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(2);
  };

  const handleBack = () => setStep(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 2 && !validateStep2()) return;

    setLoading(true);
    setErrors({});
    try {
      const payload: CreateBusinessPayload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        adminEmail: form.adminEmail.trim().toLowerCase(),
        adminName: capitalizeName(form.adminName.trim()),
      };
      if (form.address?.trim()) payload.address = form.address.trim();
      if (form.province?.trim()) payload.province = form.province.trim();

      await http.business.createBusiness(payload);
      sileo.success({
        title: '¡Tienda creada!',
        description: 'Revisá tu email. Te enviamos tu contraseña para ingresar al panel.',
      });
      navigate('/admin/login');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        setErrors(toFormErrors(apiErr.errors));
      } else {
        sileo.error({ title: apiErr.message || 'Error al crear la tienda' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Crear mi tienda</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Completá los datos en pocos pasos
          </p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Paso {step} de 2</span>
            <span>{STEPS[step - 1].title}</span>
          </div>
          <Progress value={(step / 2) * 100} className="h-2" />
        </div>

        <div className="rounded-xl border bg-card p-6">
          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleNext(); } : handleSubmit} className="space-y-5">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del negocio</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={update('name')}
                    placeholder="Ej: Mi Tienda"
                    autoFocus
                  />
                  {errors.name && <p className="text-xs text-primary">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={update('phone')}
                    placeholder="+54 11 1234-5678"
                  />
                  {errors.phone && <p className="text-xs text-primary">{errors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={update('address')}
                    placeholder="Calle, número, localidad"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">Provincia <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="province"
                    value={form.province}
                    onChange={update('province')}
                    placeholder="Ej: Buenos Aires"
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="adminName">Tu nombre</Label>
                  <Input
                    id="adminName"
                    value={form.adminName}
                    onChange={update('adminName')}
                    placeholder="Nombre del administrador"
                    autoFocus
                  />
                  {errors.adminName && <p className="text-xs text-primary">{errors.adminName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={form.adminEmail}
                    onChange={update('adminEmail')}
                    placeholder="admin@tutienda.com"
                  />
                  {errors.adminEmail && <p className="text-xs text-primary">{errors.adminEmail}</p>}
                  <p className="text-xs text-muted-foreground">
                    Te enviaremos tu contraseña de acceso a este correo.
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              {step === 2 && (
                <Button type="button" variant="outline" onClick={handleBack} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Atrás
                </Button>
              )}
              {step === 1 ? (
                <Button type="submit" className="flex-1 gap-1">
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear mi tienda'}
                </Button>
              )}
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          ¿Ya tenés una tienda?{' '}
          <Link to="/admin/login" className="text-primary hover:underline font-medium">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
