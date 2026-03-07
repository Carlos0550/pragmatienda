import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sileo } from 'sileo';
import { http } from '@/services/http';
import { toFormErrors } from '@/lib/api-utils';
import type { ApiError, FormErrors, PasswordTokenPurpose } from '@/types';

type ResetPasswordPageProps = {
  mode: 'admin' | 'customer';
};

export default function ResetPasswordPage({ mode }: ResetPasswordPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const expectedRole = mode === 'admin' ? 1 : 2;
  const loginPath = mode === 'admin' ? '/admin/login' : '/login';

  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenPurpose, setTokenPurpose] = useState<PasswordTokenPurpose>('PASSWORD_RESET');
  const [validatingToken, setValidatingToken] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setTokenError('Falta el token de restablecimiento.');
        setValidatingToken(false);
        return;
      }

      setValidatingToken(true);
      setTokenError(null);
      try {
        const result = await http.auth.validateResetPasswordToken({ token });
        const payload = result.data;
        if (!payload) {
          setTokenError(result.message || 'Token inválido o expirado.');
          return;
        }
        if (payload.role !== expectedRole) {
          setTokenError('El token no corresponde a este tipo de cuenta.');
          return;
        }
        setTokenPurpose(payload.purpose);
      } catch (error) {
        const apiError = error as ApiError;
        setTokenError(apiError.message || 'Token inválido o expirado.');
      } finally {
        setValidatingToken(false);
      }
    };

    void validate();
  }, [expectedRole, token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});

    if (newPassword !== newPasswordConfirmation) {
      setErrors({ newPasswordConfirmation: 'Las contraseñas no coinciden.' });
      return;
    }

    setSubmitting(true);
    try {
      await http.auth.resetPasswordWithToken({
        token,
        newPassword,
        newPasswordConfirmation,
      });
      sileo.success({
        title: tokenPurpose === 'ACCOUNT_SETUP' ? 'Contraseña creada' : 'Contraseña actualizada',
        description: 'Ya podés iniciar sesión.',
      });
      navigate(loginPath, { replace: true });
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.errors) {
        setErrors(toFormErrors(apiError.errors));
        return;
      }
      sileo.error({ title: apiError.message || 'No se pudo restablecer la contraseña' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-sm px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">
          {tokenPurpose === 'ACCOUNT_SETUP' ? 'Crear contraseña' : 'Restablecer contraseña'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === 'admin' ? 'Panel de administración' : 'Cuenta de cliente'}
        </p>
      </div>

      {validatingToken ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Validando enlace...
        </div>
      ) : tokenError ? (
        <div className="space-y-4 rounded-xl border bg-card p-6">
          <p className="text-sm text-primary">{tokenError}</p>
          <Button asChild className="w-full">
            <Link to={loginPath}>Volver al inicio de sesión</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nueva contraseña</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="••••••••"
              minLength={8}
              required
            />
            {errors.newPassword && <p className="text-xs text-primary">{errors.newPassword}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPasswordConfirmation">Confirmar contraseña</Label>
            <Input
              id="newPasswordConfirmation"
              type="password"
              value={newPasswordConfirmation}
              onChange={(event) => setNewPasswordConfirmation(event.target.value)}
              placeholder="••••••••"
              minLength={8}
              required
            />
            {errors.newPasswordConfirmation && (
              <p className="text-xs text-primary">{errors.newPasswordConfirmation}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Guardando...' : 'Guardar contraseña'}
          </Button>
        </form>
      )}
    </div>
  );
}
