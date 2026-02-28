import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { capitalizeName } from '@/lib/utils';
import { useStorefrontCategories, useStorefrontProducts } from '@/hooks/storefront-queries';

export default function StorefrontHome() {
  const { tenant } = useTenant();
  const { data: productsResponse, isLoading: productsLoading } = useStorefrontProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useStorefrontCategories();
  const featuredProducts = (productsResponse?.items ?? []).slice(0, 8);
  const loading = productsLoading || categoriesLoading;


  return (
    <div>
      {tenant?.banner ? (
        <section className="relative w-full h-[60vh] min-h-[400px] max-h-[600px] overflow-hidden">
          <img 
            src={tenant.banner} 
            alt={tenant.name || 'Banner'} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute bottom-0 left-0 right-0 p-6 md:p-10"
          >
            <div className="backdrop-blur-md bg-white/20 border border-white/30 rounded-2xl p-6 md:p-8 max-w-2xl shadow-xl">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-white drop-shadow-lg">
                Bienvenido a{' '}
                <span className="text-white">{capitalizeName(tenant?.name) || 'Nuestra Tienda'}</span>
              </h1>
              <p className="text-base md:text-lg text-white/90 max-w-lg mt-4 drop-shadow">
                Descubrí los mejores productos con la calidad que merecés. Comprá de forma simple y segura.
              </p>
              <div className="flex gap-3 mt-6">
                <Link to="/products">
                  <Button size="lg" className="gap-2 bg-white text-black hover:bg-white/90">
                    Ver productos
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      ) : (
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
        </section>
      )}

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
                  to={`/category/${cat.slug || cat.id}`}
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
                  to={`/products/${product.slug || product.id}`}
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
