import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, X, Building2, User, Hash, Copy, Store, Truck } from 'lucide-react';
import { sileo } from 'sileo';
import { motion } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { http } from '@/services/http';
import type { ShipmentQuote, ShippingAddress, ShippingQuoteType } from '@/types';

const emptyAddress: ShippingAddress = {
  recipientName: '',
  recipientPhone: '',
  streetName: '',
  streetNumber: '',
  floor: '',
  apartment: '',
  postalCode: '',
  city: '',
  province: '',
  country: 'Argentina',
  references: '',
};

export default function CheckoutPage() {
  const { cart, checkout, totalCart } = useCart();
  const { user } = useAuth();
  const { tenant } = useTenant();
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
  const [deliveryType, setDeliveryType] = useState<ShippingQuoteType>('PICKUP');
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(emptyAddress);
  const [quotes, setQuotes] = useState<ShipmentQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const latestQuoteRequestIdRef = useRef(0);
  const bankOptions = tenant?.bankOptions ?? [];

  useEffect(() => {
    if (!user || user.type !== 'customer') return;
    setGuestName(user.name ?? '');
    setGuestEmail(user.email ?? '');
    setGuestPhone(user.phone ?? '');
    setShippingAddress((prev) => ({
      ...prev,
      recipientName: user.name ?? prev.recipientName,
      recipientPhone: user.phone ?? prev.recipientPhone,
    }));
  }, [user]);

  const subtotal = totalCart;
  const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId) ?? null;
  const shippingPrice = selectedQuote?.price ?? 0;
  const total = subtotal + shippingPrice;

  useEffect(() => {
    if (deliveryType !== 'PICKUP') {
      latestQuoteRequestIdRef.current += 1;
      setQuotes([]);
      setSelectedQuoteId(null);
      setQuotesLoading(false);
      return;
    }

    const requestId = ++latestQuoteRequestIdRef.current;
    let active = true;

    setQuotesLoading(true);

    void http.shipping
      .quote({ quoteType: 'PICKUP' })
      .then((response) => {
        if (!active || latestQuoteRequestIdRef.current !== requestId) return;
        setQuotes(response.items);
        const firstAvailable = response.items.find((item) => item.id && !item.unavailableReason);
        setSelectedQuoteId(firstAvailable?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!active || latestQuoteRequestIdRef.current !== requestId) return;
        console.error(error);
        setQuotes([]);
        setSelectedQuoteId(null);
        sileo.error({ title: 'No se pudo cotizar el envío' });
      })
      .finally(() => {
        if (active && latestQuoteRequestIdRef.current === requestId) {
          setQuotesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [deliveryType]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setComprobante(file);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const updateAddress = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const cleanShippingAddress = (address: ShippingAddress): ShippingAddress => {
    return Object.fromEntries(
      Object.entries(address).map(([k, v]) => [
        k,
        typeof v === 'string' && v.trim() === '' ? undefined : v,
      ])
    ) as ShippingAddress;
  };

  const quoteHomeDelivery = async () => {
    const requestId = ++latestQuoteRequestIdRef.current;
    setQuotesLoading(true);
    try {
      const payload: { quoteType: ShippingQuoteType; shippingAddress?: ShippingAddress } = {
        quoteType: 'HOME_DELIVERY',
        shippingAddress: cleanShippingAddress(shippingAddress),
      };
      const response = await http.shipping.quote(payload);
      if (latestQuoteRequestIdRef.current !== requestId) return;
      setQuotes(response.items);
      const firstAvailable = response.items.find((item) => item.id && !item.unavailableReason);
      setSelectedQuoteId(firstAvailable?.id ?? null);
    } catch (error) {
      if (latestQuoteRequestIdRef.current !== requestId) return;
      console.error(error);
      setQuotes([]);
      setSelectedQuoteId(null);
      sileo.error({ title: 'No se pudo cotizar el envío' });
    } finally {
      if (latestQuoteRequestIdRef.current === requestId) {
        setQuotesLoading(false);
      }
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
    if (!selectedQuote?.shippingMethodId) {
      sileo.error({ title: 'Seleccioná una forma de envío antes de confirmar' });
      return;
    }
    if (deliveryType === 'HOME_DELIVERY') {
      const requiredFields: Array<keyof ShippingAddress> = [
        'recipientName',
        'recipientPhone',
        'streetName',
        'streetNumber',
        'postalCode',
        'city',
        'province',
        'country',
      ];
      const missing = requiredFields.some((field) => !String(shippingAddress[field] ?? '').trim());
      if (missing) {
        sileo.error({ title: 'Completá la dirección de envío antes de continuar' });
        return;
      }
    }

    setSubmitting(true);
    try {
      await checkout({
        comprobante,
        origin: 'cart',
        guestCheckout: user
          ? undefined
          : {
              name: guestName.trim(),
              email: guestEmail.trim().toLowerCase(),
              phone: guestPhone.trim(),
              createAccountAfterPurchase,
            },
        shippingMethodId: selectedQuote.shippingMethodId,
        shippingQuoteId: selectedQuote.id,
        shippingSelectionType: deliveryType,
        shippingAddress: deliveryType === 'HOME_DELIVERY' ? cleanShippingAddress(shippingAddress) : undefined,
      });
      setSuccess(true);
      sileo.success({ title: '¡Pedido realizado con éxito!' });
    } catch (error) {
      console.error(error);
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
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Checkout</h1>

      <div className="rounded-xl border bg-card p-6 space-y-3">
        <h2 className="font-semibold">Resumen del pedido</h2>
        {cart.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.product?.name ?? "Producto"} × {item.quantity}</span>
            <span className="font-medium">${((item.product?.price ?? 0) * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        <div className="border-t pt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{subtotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Envío</span>
            <span>{shippingPrice.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
          </div>
        </div>
        <div className="border-t pt-3 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>{total.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</span>
        </div>
      </div>

      {!user && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Tus datos</h2>
            <p className="text-sm text-muted-foreground mt-1">
              No necesitás una cuenta para comprar. Solo usamos estos datos para registrar tu pedido y contactarte.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="guest-name">Nombre</Label>
              <Input id="guest-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Tu nombre" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-email">Email</Label>
              <Input id="guest-email" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="tu@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-phone">Teléfono</Label>
              <Input id="guest-phone" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="+54 9 ..." />
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

      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div>
          <h2 className="font-semibold">Entrega</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Elegí si querés retirar el pedido o recibirlo en tu domicilio.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setDeliveryType('PICKUP')}
            className={`rounded-xl border p-4 text-left transition-colors ${deliveryType === 'PICKUP' ? 'border-primary bg-primary/5' : 'hover:bg-muted/20'}`}
          >
            <div className="flex items-center gap-2 font-medium">
              <Store className="h-4 w-4" />
              Retirar en local
            </div>
            <p className="text-sm text-muted-foreground mt-1">Coordinás retiro en el local del comerciante.</p>
          </button>
          <button
            type="button"
            onClick={() => setDeliveryType('HOME_DELIVERY')}
            className={`rounded-xl border p-4 text-left transition-colors ${deliveryType === 'HOME_DELIVERY' ? 'border-primary bg-primary/5' : 'hover:bg-muted/20'}`}
          >
            <div className="flex items-center gap-2 font-medium">
              <Truck className="h-4 w-4" />
              Envío a domicilio
            </div>
            <p className="text-sm text-muted-foreground mt-1">Cotizá los envíos disponibles para tu zona.</p>
          </button>
        </div>

        {deliveryType === 'HOME_DELIVERY' && (
          <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Destinatario</Label>
                <Input value={shippingAddress.recipientName} onChange={(e) => updateAddress('recipientName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={shippingAddress.recipientPhone} onChange={(e) => updateAddress('recipientPhone', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Código postal</Label>
                <Input value={shippingAddress.postalCode} onChange={(e) => updateAddress('postalCode', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Calle</Label>
                <Input value={shippingAddress.streetName} onChange={(e) => updateAddress('streetName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={shippingAddress.streetNumber} onChange={(e) => updateAddress('streetNumber', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Piso</Label>
                <Input value={shippingAddress.floor ?? ''} onChange={(e) => updateAddress('floor', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input value={shippingAddress.apartment ?? ''} onChange={(e) => updateAddress('apartment', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input value={shippingAddress.city} onChange={(e) => updateAddress('city', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Provincia</Label>
                <Input value={shippingAddress.province} onChange={(e) => updateAddress('province', e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Referencias</Label>
                <Textarea value={shippingAddress.references ?? ''} onChange={(e) => updateAddress('references', e.target.value)} rows={2} />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => void quoteHomeDelivery()} disabled={quotesLoading}>
              {quotesLoading ? 'Cotizando...' : 'Cotizar envíos'}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-medium text-sm">Opciones disponibles</h3>
          {quotesLoading ? (
            <p className="text-sm text-muted-foreground">Buscando opciones...</p>
          ) : quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {deliveryType === 'PICKUP'
                ? 'Todavía no hay una forma de retiro en local activa.'
                : 'Completá la dirección y cotizá para ver opciones disponibles.'}
            </p>
          ) : (
            <div className="space-y-3">
              {quotes.map((quote, index) => {
                const checked = selectedQuoteId === quote.id;
                return (
                  <label key={`${quote.shippingMethodId}-${quote.id ?? index}`} className={`flex items-start gap-3 rounded-lg border p-4 ${checked ? 'border-primary bg-primary/5' : ''}`}>
                    <input
                      type="radio"
                      checked={checked}
                      disabled={!quote.id || Boolean(quote.unavailableReason)}
                      onChange={() => setSelectedQuoteId(quote.id ?? null)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">{quote.methodName}</p>
                          <p className="text-sm text-muted-foreground">{quote.serviceName ?? quote.providerCode}</p>
                        </div>
                        <span className="font-semibold">
                          {(quote.price ?? 0).toLocaleString('es-AR', { style: 'currency', currency: quote.currency ?? 'ARS' })}
                        </span>
                      </div>
                      {quote.unavailableReason && (
                        <p className="text-xs text-primary mt-2">{quote.unavailableReason}</p>
                      )}
                      {quote.pickupDetails && (
                        <div className="mt-2 text-xs text-muted-foreground space-y-1">
                          {(quote.pickupDetails.instructions as string | undefined) && <p>{String(quote.pickupDetails.instructions)}</p>}
                          {(quote.pickupDetails.address as string | undefined) && <p>Dirección: {String(quote.pickupDetails.address)}</p>}
                          {(quote.pickupDetails.businessHours as string | undefined) && <p>Horario: {String(quote.pickupDetails.businessHours)}</p>}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
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

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

        {preview ? (
          <div className="relative">
            <img src={preview} alt="Comprobante" className="rounded-lg max-h-64 w-full object-contain border" />
            <button
              type="button"
              onClick={() => {
                setComprobante(null);
                setPreview(null);
                if (fileRef.current) {
                  fileRef.current.value = '';
                }
              }}
              className="absolute top-2 right-2 p-1 rounded-full bg-foreground/80 text-background hover:bg-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-accent/30 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Hacé clic para subir el comprobante</span>
          </button>
        )}

        <Button onClick={handleSubmit} disabled={!comprobante || submitting || !selectedQuote?.shippingMethodId} className="w-full" size="lg">
          {submitting ? 'Procesando...' : 'Confirmar pedido'}
        </Button>
      </div>
    </div>
  );
}
