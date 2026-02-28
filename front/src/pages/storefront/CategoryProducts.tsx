import { Link, useNavigate, useParams } from "react-router-dom";
import { Filter, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { useStorefrontCategories, useStorefrontCategoryBySlug, useStorefrontProducts } from "@/hooks/storefront-queries";

export default function CategoryProductsPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { data: category, isLoading: categoryLoading } = useStorefrontCategoryBySlug(slug);
  const { data: categories = [] } = useStorefrontCategories();
  const { data: productResponse, isLoading: productsLoading } = useStorefrontProducts({ categorySlug: slug ?? null });
  const products = productResponse?.items ?? [];
  const loading = categoryLoading || productsLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-56 shrink-0">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4" /> Categorías
          </h2>
          <div className="space-y-1">
            <button
              onClick={() => navigate("/products")}
              className="block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-accent"
            >
              Todas
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/category/${cat.slug}`)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  cat.slug === slug ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">
              {category?.name ? `Categoría: ${category.name}` : "Categoría"}
            </h1>
            <span className="text-sm text-muted-foreground">{products.length} productos</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-muted aspect-[3/4]" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
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
                      <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                      <h3 className="text-sm font-medium line-clamp-2">{product.name}</h3>
                      <span className="text-lg font-bold">${product.price.toLocaleString()}</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No se encontraron productos en esta categoría.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
