import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function CartPage() {
  const { cart, itemCount, loading, fetchCart, updateItem, removeItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) fetchCart();
  }, [user, fetchCart]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold mb-2">Tu Carrito</h1>
        <p className="text-muted-foreground mb-6">Iniciá sesión para ver tu carrito.</p>
        <Link to="/login"><Button>Iniciar sesión</Button></Link>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold mb-2">Tu carrito está vacío</h1>
        <p className="text-muted-foreground mb-6">Agregá productos para comenzar.</p>
        <Link to="/products"><Button>Ver productos</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Tu Carrito ({itemCount} items)</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {cart.items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex gap-4 p-4 rounded-xl border bg-card"
            >
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                {item.product.images?.[0] ? (
                  <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{item.product.name}</h3>
                <p className="text-lg font-bold mt-1">${item.product.price.toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => removeItem(item.productId)} className="text-muted-foreground hover:text-primary transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-center border rounded-lg">
                  <button onClick={() => updateItem(item.productId, Math.max(1, item.quantity - 1))} className="p-1.5 hover:bg-accent transition-colors">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="px-3 text-sm">{item.quantity}</span>
                  <button onClick={() => updateItem(item.productId, item.quantity + 1)} className="p-1.5 hover:bg-accent transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-xl border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Resumen del pedido</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${cart.total.toLocaleString()}</span>
            </div>
            <div className="border-t pt-4 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>${cart.total.toLocaleString()}</span>
            </div>
            <Button className="w-full gap-2" size="lg" onClick={() => navigate('/checkout')}>
              Finalizar compra <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
