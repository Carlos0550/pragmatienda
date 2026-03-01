import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, ImageIcon, X } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { http } from '@/services/http';
import { Button } from '@/components/ui/button';
import { sileo } from 'sileo';
import { motion } from 'framer-motion';

export default function CheckoutPage() {
  const { cart, checkout, totalCart } = useCart();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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
    setSubmitting(true);
    try {
      const res = await checkout(comprobante);
      setSuccess(true);
      sileo.success({ title: '¡Pedido realizado con éxito!' });
    } catch {
      sileo.error({ title: 'Error al procesar el pedido' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMPCheckout = async (orderId: string) => {
    try {
      const result = await http.payments.createCheckout(orderId);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch {
      sileo.error({ title: 'Error al iniciar pago con Mercado Pago' });
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
