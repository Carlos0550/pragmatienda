import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { http } from '@/services/http';
import { useAuth } from '@/contexts/AuthContext';
import { sileo } from 'sileo';
import type { ApiError, FormErrors } from '@/types';
import { toFormErrors } from '@/lib/api-utils';

export function PasswordSetupModal() {
  const { user, passwordSetupToken, setPasswordSetupToken } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  if (!user || !passwordSetupToken) {
    return null;
  }

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
        token: passwordSetupToken,
        newPassword,
        newPasswordConfirmation,
      });
      setPasswordSetupToken(null);
      sileo.success({
        title: 'Contraseña guardada',
        description: 'Tu cuenta ya quedó protegida con tu nueva contraseña.',
      });
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.errors) {
        setErrors(toFormErrors(apiError.errors));
      } else {
        sileo.error({ title: apiError.message || 'No se pudo guardar la contraseña' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Protegé tu cuenta</h2>
          <p className="text-sm text-muted-foreground">
            Por seguridad, ingresá una contraseña que recuerdes para tu cuenta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setup-new-password">Nueva contraseña</Label>
            <Input
              id="setup-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              placeholder="••••••••"
              required
            />
            {errors.newPassword && <p className="text-xs text-primary">{errors.newPassword}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-new-password-confirmation">Confirmar contraseña</Label>
            <Input
              id="setup-new-password-confirmation"
              type="password"
              value={newPasswordConfirmation}
              onChange={(event) => setNewPasswordConfirmation(event.target.value)}
              minLength={8}
              placeholder="••••••••"
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
      </div>
    </div>
  );
}
