import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, User, ChevronRight, ChevronLeft, MailCheck, ArrowRight } from 'lucide-react';
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
  const [createdAccount, setCreatedAccount] = useState<{
    adminEmail: string;
    businessName: string;
  } | null>(null);
  const [nameAvailability, setNameAvailability] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({
    checking: false,
    available: null,
    message: '',
  });
  const trimmedBusinessName = useMemo(() => form.name.trim(), [form.name]);

  const update = (field: keyof CreateBusinessPayload) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'name') {
      setNameAvailability({ checking: false, available: null, message: '' });
    }
  };

  useEffect(() => {
    if (step !== 1) return;

    if (!trimmedBusinessName) {
      setNameAvailability({ checking: false, available: null, message: '' });
      return;
    }

    if (trimmedBusinessName.length < 3) {
      setNameAvailability({ checking: false, available: null, message: 'Mínimo 3 caracteres' });
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setNameAvailability({ checking: true, available: null, message: '' });
      try {
        const response = await http.business.checkBusinessNameAvailability(trimmedBusinessName);
        const available = response.data?.available === true;
        const message = response.message || (available ? 'Nombre disponible' : 'El nombre del negocio ya existe');
        setNameAvailability({ checking: false, available, message });
        if (available) {
          setErrors((prev) => ({ ...prev, name: '' }));
        } else {
          setErrors((prev) => ({ ...prev, name: message }));
        }
      } catch {
        setNameAvailability({ checking: false, available: null, message: 'No se pudo validar el nombre ahora' });
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [step, trimmedBusinessName]);

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

    if (trimmedBusinessName.length >= 3) {
      if (nameAvailability.checking) return;
      if (nameAvailability.available === false) {
        setErrors((prev) => ({ ...prev, name: nameAvailability.message || 'El nombre del negocio ya existe' }));
        return;
      }
      if (nameAvailability.available !== true) {
        setErrors((prev) => ({ ...prev, name: 'Validá que el nombre del negocio esté disponible' }));
        return;
      }
    }

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

      const response = await http.business.createBusiness(payload);
      setCreatedAccount({
        adminEmail: response.data?.adminEmail ?? payload.adminEmail,
        businessName: payload.name,
      });
      sileo.success({
        title: '¡Tienda creada!',
        description: 'Revisá tu email y verificá tu cuenta para ingresar al panel.',
      });
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        setErrors(toFormErrors(apiErr.errors));
        sileo.error({ title: apiErr.message || 'Error al crear la tienda' });
      } else if (apiErr.message?.toLowerCase().includes('nombre del negocio')) {
        setErrors((prev) => ({ ...prev, name: apiErr.message || 'El nombre del negocio ya existe' }));
        
        setStep(1);
      } else if (apiErr.message?.toLowerCase().includes('teléfono del negocio')) {
        setErrors((prev) => ({ ...prev, phone: apiErr.message || 'El teléfono del negocio ya está registrado' }));
        setStep(1);
      } else {
        sileo.error({ title: apiErr.message || 'Error al crear la tienda' });
      }
    } finally {
      setLoading(false);
    }
  };

  if (createdAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
        <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-sm space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Tu tienda ya fue creada</h1>
            <p className="text-sm text-muted-foreground">
              Enviamos un correo a <span className="font-medium text-foreground">{createdAccount.adminEmail}</span> para que actives tu cuenta de administrador.
            </p>
          </div>

          <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
            <p className="text-sm font-medium">Próximos pasos</p>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Abrí el correo de bienvenida de {createdAccount.businessName}.</li>
              <li>2. Hacé clic en el enlace de verificación.</li>
              <li>3. Ingresá al panel y definí tu contraseña para completar la activación.</li>
            </ol>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="flex-1">
              <Link to="/">
                Volver a la landing <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setCreatedAccount(null);
                setStep(1);
                setForm(initialForm);
                setErrors({});
                setNameAvailability({ checking: false, available: null, message: '' });
              }}
            >
              Crear otra tienda
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
                  {!errors.name && trimmedBusinessName.length >= 3 && nameAvailability.message && (
                    <p className={`text-xs ${nameAvailability.available ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {nameAvailability.checking ? 'Validando nombre...' : nameAvailability.message}
                    </p>
                  )}
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
                <Button type="submit" className="flex-1 gap-1" disabled={nameAvailability.checking}>
                  {nameAvailability.checking ? 'Validando...' : 'Siguiente'}
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
