import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { http } from '@/services/http';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import type { Category, Product } from '@/types';
import { motion } from 'framer-motion';
import { capitalizeName } from '@/lib/utils';

export default function StorefrontHome() {
  const { tenant } = useTenant();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodsRes, catsRes] = await Promise.all([
          http.products.listPublic().catch(() => null),
          http.categories.listPublic().catch(() => null),
        ]);
        const products = prodsRes?.items ?? [];
        setFeaturedProducts(products.slice(0, 8));
        setCategories(catsRes ?? []);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);


  return (
    <div>
      <section className="relative overflow-hidden bg-secondary/30">
        <div className="container mx-auto px-4 py-20 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl space-y-6"
          >
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight leading-tight">
              Bienvenido a{' '}
              <span className="text-primary">{capitalizeName(tenant?.name) || 'Nuestra Tienda'}</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg">
              Descubrí los mejores productos con la calidad que merecés. Comprá de forma simple y segura.
            </p>
            <div className="flex gap-3">
              <Link to="/products">
                <Button size="lg" className="gap-2">
                  Ver productos
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
        {tenant?.banner && (
          <div className="absolute inset-0 -z-10 opacity-10">
            <img src={tenant.banner} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Categorías</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/products?category=${cat.id}`}
                  className="group relative flex flex-col items-center gap-3 p-6 rounded-xl border bg-card hover:border-primary/30 hover:shadow-md transition-all"
                >
                  {cat.image && (
                    <img src={cat.image} alt={cat.name} className="w-16 h-16 object-cover rounded-lg" />
                  )}
                  <span className="text-sm font-medium text-center">{cat.name}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Productos Destacados</h2>
          <Link to="/products" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl bg-muted aspect-[3/4]" />
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/products/${product.slug}`}
                  className="group rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-all block"
                >
                  <div className="aspect-square overflow-hidden bg-muted">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <h3 className="text-sm font-medium line-clamp-2">{product.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">${product.price.toLocaleString()}</span>
                      {product.compareAtPrice && (
                        <span className="text-xs text-muted-foreground line-through">
                          ${product.compareAtPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Aún no hay productos disponibles.</p>
          </div>
        )}
      </section>
    </div>
  );
}
