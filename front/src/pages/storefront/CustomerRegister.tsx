import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sileo } from 'sileo';
import type { ApiError } from '@/services/api';
import { capitalizeName } from '@/lib/utils';

export default function CustomerRegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', passwordConfirmation: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (form.password !== form.passwordConfirmation) {
      setErrors({ passwordConfirmation: 'Las contraseñas no coinciden' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/public/register', {
        name: capitalizeName(form.name),
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      sileo.success({ title: '¡Cuenta creada! Iniciá sesión.' });
      navigate('/login');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(apiErr.errors).forEach(([k, v]) => { fieldErrors[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(fieldErrors);
      } else {
        sileo.error({ title: apiErr.message || 'Error al registrarse' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">Crear Cuenta</h1>
        <p className="text-sm text-muted-foreground mt-2">Registrate para empezar a comprar</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre completo</Label>
          <Input id="name" value={form.name} onChange={handleChange('name')} placeholder="Tu nombre" required />
          {errors.name && <p className="text-xs text-primary">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={handleChange('email')} placeholder="tu@email.com" required />
          {errors.email && <p className="text-xs text-primary">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono (opcional)</Label>
          <Input id="phone" value={form.phone} onChange={handleChange('phone')} placeholder="+54 9 11 1234-5678" />
          {errors.phone && <p className="text-xs text-primary">{errors.phone}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" type="password" value={form.password} onChange={handleChange('password')} placeholder="••••••••" required />
          {errors.password && <p className="text-xs text-primary">{errors.password}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirmation">Confirmar contraseña</Label>
          <Input id="passwordConfirmation" type="password" value={form.passwordConfirmation} onChange={handleChange('passwordConfirmation')} placeholder="••••••••" required />
          {errors.passwordConfirmation && <p className="text-xs text-primary">{errors.passwordConfirmation}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Registrando...' : 'Crear Cuenta'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="text-primary hover:underline font-medium">Iniciá sesión</Link>
      </p>
    </div>
  );
}
