import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, X, Building2, User, Hash, Copy } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sileo } from 'sileo';
import { motion } from 'framer-motion';

export default function CheckoutPage() {
  const { cart, checkout, totalCart } = useCart();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const bankOptions = tenant?.bankOptions ?? [];
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [createAccountAfterPurchase, setCreateAccountAfterPurchase] = useState(false);

  useEffect(() => {
    if (!user || user.type !== 'customer') return;
    setGuestName(user.name ?? '');
    setGuestEmail(user.email ?? '');
    setGuestPhone(user.phone ?? '');
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setComprobante(file);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!comprobante) {
      sileo.error({ title: 'Subí el comprobante de pago' });
      return;
    }
    if (!user) {
      if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim()) {
        sileo.error({ title: 'Completá nombre, email y teléfono para continuar' });
        return;
      }
    }
    setSubmitting(true);
    try {
      await checkout(
        comprobante,
        user
          ? undefined
          : {
              name: guestName.trim(),
              email: guestEmail.trim().toLowerCase(),
              phone: guestPhone.trim(),
              createAccountAfterPurchase,
            }
      );
      setSuccess(true);
      sileo.success({ title: '¡Pedido realizado con éxito!' });
    } catch {
      sileo.error({ title: 'Error al procesar el pedido' });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
          <CheckCircle className="h-16 w-16 text-success mx-auto" />
          <h1 className="text-2xl font-bold">¡Pedido Confirmado!</h1>
          <p className="text-muted-foreground">Tu pedido fue recibido y está siendo procesado.</p>
          <Button onClick={() => navigate('/products')} variant="outline">Seguir comprando</Button>
        </motion.div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">No hay items en tu carrito.</p>
        <Button onClick={() => navigate('/products')}>Ver productos</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>

      {/* Order Summary */}
      <div className="rounded-xl border bg-card p-6 mb-6 space-y-3">
        <h2 className="font-semibold">Resumen del pedido</h2>
        {cart.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.product?.name ?? "Producto"} × {item.quantity}</span>
            <span className="font-medium">${((item.product?.price ?? 0) * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        <div className="border-t pt-3 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>{(totalCart ?? 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" }) ?? "0"}</span>
        </div>
      </div>

      {/* Upload comprobante */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        {!user && (
          <div className="space-y-4 border-b pb-6">
            <div>
              <h2 className="font-semibold">Tus datos</h2>
              <p className="text-sm text-muted-foreground mt-1">
                No necesitás una cuenta para comprar. Solo usamos estos datos para registrar tu pedido y contactarte.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="guest-name">Nombre</Label>
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-email">Email</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-phone">Teléfono</Label>
                <Input
                  id="guest-phone"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+54 9 ..."
                />
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
              <input
                type="checkbox"
                checked={createAccountAfterPurchase}
                onChange={(e) => setCreateAccountAfterPurchase(e.target.checked)}
                className="mt-1"
              />
              <span>
                Crear una cuenta automáticamente después de la compra.
                <span className="block text-xs text-muted-foreground mt-1">
                  Si la marcás, vamos a enviarte un email para verificar tu cuenta y definir tu contraseña.
                </span>
              </span>
            </label>
          </div>
        )}

        {bankOptions.length > 0 && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <h3 className="font-semibold text-sm">Datos para la transferencia</h3>
            <p className="text-xs text-muted-foreground">
              Realizá la transferencia a una de estas cuentas y luego subí el comprobante.
            </p>
            <ul className="space-y-4">
              {bankOptions.map((option, index) => (
                <li key={index} className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {option.bankName}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>Titular: {option.recipientName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span>Alias/CBU/CVU: {option.aliasCvuCbu}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(option.aliasCvuCbu);
                        sileo.success({ title: 'Copiado al portapapeles', duration: 1500 });
                      }}
                      className="ml-1 p-1 rounded hover:bg-muted transition-colors"
                      title="Copiar"
                      aria-label="Copiar Alias/CBU/CVU"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2 className="font-semibold">Comprobante de pago</h2>
        <p className="text-sm text-muted-foreground">
          Realizá la transferencia y subí el comprobante para confirmar tu pedido.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {preview ? (
          <div className="relative">
            <img src={preview} alt="Comprobante" className="rounded-lg max-h-64 w-full object-contain border" />
            <button
              onClick={() => { setComprobante(null); setPreview(null); }}
              className="absolute top-2 right-2 p-1 rounded-full bg-foreground/80 text-background hover:bg-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-accent/30 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Hacé clic para subir el comprobante</span>
          </button>
        )}

        <Button onClick={handleSubmit} disabled={!comprobante || submitting} className="w-full" size="lg">
          {submitting ? 'Procesando...' : 'Confirmar Pedido'}
        </Button>
      </div>
    </div>
  );
}
