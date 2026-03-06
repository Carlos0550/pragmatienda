import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { capitalizeName } from '@/lib/utils';
import { useStorefrontCategories, useStorefrontProducts } from '@/hooks/storefront-queries';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import type { BannerOverlayPosition } from '@/types';

const INTRO_OVERLAY_DURATION_MS = 4500;

const OVERLAY_POSITION_LAYOUT: Record<BannerOverlayPosition, string> = {
  'bottom-left': 'items-end justify-start',
  'bottom-center': 'items-end justify-center',
  'bottom-right': 'items-end justify-end',
  'top-left': 'items-start justify-start',
  'top-center': 'items-start justify-center',
  'top-right': 'items-start justify-end',
  center: 'items-center justify-center',
};

const OVERLAY_TEXT_ALIGN: Record<BannerOverlayPosition, string> = {
  'bottom-left': 'text-left',
  'bottom-center': 'text-center',
  'bottom-right': 'text-right',
  'top-left': 'text-left',
  'top-center': 'text-center',
  'top-right': 'text-right',
  center: 'text-center',
};

const OVERLAY_COPY_ALIGN: Record<BannerOverlayPosition, string> = {
  'bottom-left': 'mr-auto',
  'bottom-center': 'mx-auto',
  'bottom-right': 'ml-auto',
  'top-left': 'mr-auto',
  'top-center': 'mx-auto',
  'top-right': 'ml-auto',
  center: 'mx-auto',
};

const OVERLAY_MESSAGE_ALIGN: Record<BannerOverlayPosition, string> = {
  'bottom-left': 'text-left',
  'bottom-center': 'text-center',
  'bottom-right': 'text-right',
  'top-left': 'text-left',
  'top-center': 'text-center',
  'top-right': 'text-right',
  center: 'text-center',
};

export default function StorefrontHome() {
  const { tenant } = useTenant();
  const { data: productsResponse, isLoading: productsLoading } = useStorefrontProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useStorefrontCategories();
  const featuredProducts = (productsResponse?.items ?? []).slice(0, 8);
  const loading = productsLoading || categoriesLoading;
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showIntroOverlay, setShowIntroOverlay] = React.useState(false);
  const [introCountdownMs, setIntroCountdownMs] = React.useState(INTRO_OVERLAY_DURATION_MS);

  const hasBanners = (tenant?.banners?.length ?? 0) > 0;
  const bannerCount = tenant?.banners?.length ?? 0;
  const canNavigateBanners = bannerCount > 1;
  const overlayPos = (tenant?.bannerOverlayPosition || 'bottom-left') as BannerOverlayPosition;
  const overlayLayout = OVERLAY_POSITION_LAYOUT[overlayPos] ?? OVERLAY_POSITION_LAYOUT['bottom-left'];
  const overlayTextAlign = OVERLAY_TEXT_ALIGN[overlayPos] ?? OVERLAY_TEXT_ALIGN['bottom-left'];
  const overlayCopyAlign = OVERLAY_COPY_ALIGN[overlayPos] ?? OVERLAY_COPY_ALIGN['bottom-left'];
  const overlayMessageAlign = OVERLAY_MESSAGE_ALIGN[overlayPos] ?? OVERLAY_MESSAGE_ALIGN['bottom-left'];
  const introCountdownSeconds = Math.max(0, Math.ceil(introCountdownMs / 1000));

  React.useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => setSelectedIndex(carouselApi.selectedScrollSnap());

    onSelect();
    carouselApi.on('select', onSelect);
    carouselApi.on('reInit', onSelect);

    return () => {
      carouselApi.off('select', onSelect);
      carouselApi.off('reInit', onSelect);
    };
  }, [carouselApi]);

  React.useEffect(() => {
    if (!hasBanners) {
      setShowIntroOverlay(false);
      return;
    }

    setShowIntroOverlay(true);
    setIntroCountdownMs(INTRO_OVERLAY_DURATION_MS);

    const timer = window.setTimeout(() => {
      setShowIntroOverlay(false);
      setIntroCountdownMs(0);
    }, INTRO_OVERLAY_DURATION_MS);
    const countdownInterval = window.setInterval(() => {
      setIntroCountdownMs((previous) => Math.max(0, previous - 100));
    }, 100);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(countdownInterval);
    };
  }, [hasBanners, tenant?.id, bannerCount]);

  const handlePrevBanner = () => {
    carouselApi?.scrollPrev();
  };

  const handleNextBanner = () => {
    carouselApi?.scrollNext();
  };

  const bannerWelcomeContent = (
    <motion.div
      initial={{ opacity: 0, y: hasBanners ? 30 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`relative w-full max-w-[92vw] sm:max-w-[34rem] lg:max-w-[42rem] rounded-2xl border border-white/25 bg-black/45 p-4 sm:p-5 md:p-6 backdrop-blur-md shadow-xl ${overlayTextAlign}`}
    >
      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85 sm:right-3 sm:top-3">
        {introCountdownSeconds}s
      </span>
      <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-tight text-white drop-shadow-lg">
        Bienvenido a{' '}
        <span className="text-white">{capitalizeName(tenant?.name) || 'Nuestra Tienda'}</span>
      </h1>
      <p className={`mt-3 text-sm sm:text-base md:text-lg text-white/90 max-w-xl drop-shadow ${overlayCopyAlign}`}>
        Descubrí los mejores productos con la calidad que merecés. Comprá de forma simple y segura.
      </p>
      <p className={`mt-5 text-sm sm:text-base text-white/85 ${overlayMessageAlign}`}>
        Esperamos que tengas una linda experiencia en nuestra web.
      </p>
    </motion.div>
  );

  const welcomeContent = (
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
  );

  return (
    <div>
      {hasBanners ? (
        <section className="relative w-full overflow-hidden bg-background">
          <div className="relative h-[clamp(260px,42vh,340px)] max-[479px]:h-auto max-[479px]:aspect-[3/4] sm:h-[clamp(300px,46vh,420px)] md:h-[clamp(320px,50vh,560px)] lg:h-[clamp(400px,66vh,760px)]">
            <Carousel
              opts={{ align: 'start', loop: canNavigateBanners }}
              setApi={setCarouselApi}
              className="absolute inset-0 [&>div]:h-full [&>div>div]:h-full"
            >
              <CarouselContent className="h-full ml-0">
                {(tenant?.banners ?? []).map((item, index) => {
                  const objPos = `${item.objectPositionX ?? 50}% ${item.objectPositionY ?? 50}%`;
                  return (
                    <CarouselItem key={`${item.url}-${index}`} className="basis-full h-full pl-0">
                      <img
                        src={item.url}
                        alt={`Banner ${index + 1}`}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: objPos }}
                        loading={index === 0 ? 'eager' : 'lazy'}
                      />
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
            <AnimatePresence>
              {showIntroOverlay && (
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98, filter: 'blur(3px)' }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`absolute inset-0 z-10 flex p-3 sm:p-4 md:p-6 lg:p-10 pointer-events-none ${overlayLayout}`}
                >
                  <div className="pointer-events-auto w-full">
                    {bannerWelcomeContent}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {canNavigateBanners && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handlePrevBanner}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 hidden sm:inline-flex h-9 w-9 sm:h-10 sm:w-10 rounded-full border-white/40 bg-black/45 text-white hover:bg-black/60"
                  aria-label="Banner anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleNextBanner}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 hidden sm:inline-flex h-9 w-9 sm:h-10 sm:w-10 rounded-full border-white/40 bg-black/45 text-white hover:bg-black/60"
                  aria-label="Banner siguiente"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
            {canNavigateBanners && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 hidden sm:flex items-center gap-2">
                {(tenant?.banners ?? []).map((item, index) => (
                  <button
                    key={`banner-indicator-${item.url}-${index}`}
                    type="button"
                    onClick={() => carouselApi?.scrollTo(index)}
                    className={`h-2 rounded-full transition-all ${
                      selectedIndex === index ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'
                    }`}
                    aria-label={`Ir al banner ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="relative overflow-hidden bg-secondary/30">
          <div className="container mx-auto px-4 py-20 lg:py-32">
            {welcomeContent}
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
