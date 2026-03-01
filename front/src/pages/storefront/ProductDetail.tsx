import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, ArrowLeft } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { sileo } from 'sileo';
import { useStorefrontProductDetail } from '@/hooks/storefront-queries';
import { capitalizeName } from '@/lib/utils';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const { addItem } = useCart();
  const { user } = useAuth();
  const { data: product, isLoading: loading } = useStorefrontProductDetail(slug);

  const handleAddToCart = async () => {
    if (!user) {
      sileo.error({ title: 'Iniciá sesión para agregar productos al carrito' });
      return;
    }
    if (!product) return;
    try {
      await addItem(product.id, quantity);
      sileo.success({ title: 'Producto agregado al carrito' });
    } catch {
      sileo.error({ title: 'Error al agregar al carrito' });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="animate-pulse rounded-xl bg-muted aspect-square" />
          <div className="space-y-4">
            <div className="animate-pulse h-8 w-2/3 bg-muted rounded" />
            <div className="animate-pulse h-6 w-1/3 bg-muted rounded" />
            <div className="animate-pulse h-24 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Producto no encontrado</h1>
        <Link to="/products"><Button variant="outline">Ver productos</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Volver a productos
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Images */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="aspect-square rounded-xl overflow-hidden bg-muted border">
            {product.images?.[selectedImage] ? (
              <img src={product.images[selectedImage]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">Sin imagen</div>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${
                    selectedImage === i ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Info */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          {product.categoryName && (
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{product.categoryName}</span>
          )}
          <h1 className="text-3xl font-bold">{capitalizeName(product.name || "") || "Producto sin nombre"}</h1>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">${product.price.toLocaleString()}</span>
            {product.compareAtPrice && (
              <span className="text-lg text-muted-foreground line-through">${product.compareAtPrice.toLocaleString()}</span>
            )}
          </div>

          <p className="text-muted-foreground leading-relaxed">{product.description}</p>

          {product.stock > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Cantidad:</span>
                <div className="flex items-center border rounded-lg">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 hover:bg-accent transition-colors">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-4 text-sm font-medium">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="p-2 hover:bg-accent transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">{product.stock} disponibles</span>
              </div>
              <Button onClick={handleAddToCart} size="lg" className="w-full gap-2">
                <ShoppingCart className="h-4 w-4" />
                Agregar al carrito
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-muted text-center">
              <span className="text-sm font-medium text-muted-foreground">Producto sin stock</span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
