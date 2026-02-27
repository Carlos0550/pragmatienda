import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sileo } from 'sileo';
import { api } from '@/services/api';
import type { ApiError } from '@/services/api';

export default function CustomerLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const { loginCustomer } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await loginCustomer(email, password);
      sileo.success({ title: '¡Bienvenido!' });
      navigate('/');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(apiErr.errors).forEach(([k, v]) => { fieldErrors[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(fieldErrors);
      } else {
        sileo.error({ title: apiErr.message || 'Error al iniciar sesión' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await api.post('/public/password/recovery', { email: forgotEmail });
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
    <div className="container mx-auto px-4 py-16 max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">
          {showForgotPassword ? 'Recuperar contraseña' : 'Iniciar Sesión'}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {showForgotPassword ? 'Ingresá tu email y te enviamos un enlace' : 'Ingresá a tu cuenta para continuar'}
        </p>
      </div>

      {showForgotPassword ? (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="tu@email.com"
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
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required />
            {errors.email && <p className="text-xs text-primary">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            {errors.password && <p className="text-xs text-primary">{errors.password}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
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
        </form>
      )}

      {!showForgotPassword && (
        <>
          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿No tenés cuenta?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">Registrate</Link>
          </p>
          <p className="text-left text-sm text-muted-foreground mt-6">
            <Link to="/admin/login" className="text-primary hover:underline font-medium">Ir al panel de administración</Link>
          </p>
        </>
      )}
    </div>
  );
}
