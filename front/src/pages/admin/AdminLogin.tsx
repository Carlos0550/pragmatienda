import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sileo } from 'sileo';
import { http } from '@/services/http';
import { toFormErrors } from '@/lib/api-utils';
import type { ApiError, FormErrors } from '@/types';
import { useTenant } from '@/contexts/TenantContext';
import { capitalizeName } from '@/lib/utils';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const { loginAdmin, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const name = tenant?.name;

  useEffect(() => {
    if (authLoading) return;
    if (user?.type === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await loginAdmin(email, password);
      sileo.success({ title: '¡Bienvenido al panel de administración!' });
      navigate('/admin');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        setErrors(toFormErrors(apiErr.errors));
      } else {
        sileo.error({ title: apiErr.message || 'Credenciales inválidas' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await http.auth.recoverAdminPassword({ email: forgotEmail });
      sileo.success({
        title: 'Correo enviado',
        description: 'Revisá tu bandeja de entrada. Si el email está registrado, recibirás un enlace para restablecer tu contraseña.',
      });
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (err) {
      const apiErr = err as ApiError;
      sileo.error({ title: apiErr.message || 'Error al solicitar recuperación' });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {capitalizeName(name || 'PragmaTienda')}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {showForgotPassword ? 'Recuperar contraseña de administrador' : 'Bienvenido al panel de administración de tu tienda'}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6">
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email del administrador</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="admin@tutienda.com"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={forgotLoading}>
                {forgotLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </Button>
              <button
                type="button"
                onClick={() => { setShowForgotPassword(false); setForgotEmail(''); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Volver al inicio de sesión
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@tutienda.com" required />
                {errors.email && <p className="text-xs text-primary">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                {errors.password && <p className="text-xs text-primary">{errors.password}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-primary hover:underline font-medium"
                >
                  Olvidé mi contraseña
                </button>
              </p>
              <p className="text-left text-sm text-muted-foreground">
                <Link to="/" className="text-primary hover:underline font-medium">Ir a la tienda</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
