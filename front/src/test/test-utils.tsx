import React, { ReactElement } from 'react';
import { MemoryRouter, MemoryRouterProps, Routes, Route } from 'react-router-dom';

/**
 * Envuelve el componente con MemoryRouter para tests que usan useParams, useSearchParams o Link.
 */
export function withRouter(
  ui: ReactElement,
  options: { initialEntries?: MemoryRouterProps['initialEntries']; initialIndex?: number } = {}
) {
  const { initialEntries = ['/'], initialIndex } = options;
  return (
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      {ui}
    </MemoryRouter>
  );
}

/**
 * Envuelve una ruta con parámetro (ej. /products/:slug) para que useParams() funcione en tests.
 */
export function withRoute(
  path: string,
  element: ReactElement,
  options: { initialEntries?: MemoryRouterProps['initialEntries'] } = {}
) {
  const { initialEntries = [path.replace(':slug', 'test')] } = options;
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>
  );
}

/** Crea N productos de prueba con imágenes para tests de carga masiva */
export function buildMockProducts(count: number, overrides: { withImage?: boolean; categoryId?: string } = {}) {
  const withImage = overrides.withImage !== false;
  return Array.from({ length: count }, (_, i) => ({
    id: `prod-${i + 1}`,
    name: `Producto ${i + 1}`,
    slug: `producto-${i + 1}`,
    description: `Descripción del producto ${i + 1}`,
    price: 1000 + i * 100,
    compareAtPrice: 1500 + i * 100,
    image: withImage ? `https://example.com/img-${i + 1}.jpg` : undefined,
    categoryId: overrides.categoryId ?? 'cat-1',
    category: { id: overrides.categoryId ?? 'cat-1', name: 'Categoría A' },
    stock: 10,
    status: 'PUBLISHED',
  }));
}

/** Crea categorías de prueba, algunas con imagen y otras sin */
export function buildMockCategories(options: { withImages?: boolean[] } = {}) {
  const withImages = options.withImages ?? [true, false, true, false]; // alterna con/sin imagen
  return withImages.map((withImage, i) => ({
    id: `cat-${i + 1}`,
    name: `Categoría ${i + 1}`,
    slug: `categoria-${i + 1}`,
    image: withImage ? `https://example.com/cat-${i + 1}.jpg` : undefined,
    productCount: (i + 1) * 2,
  }));
}

/** Respuesta API típica de productos del backend */
export function mockProductsApiResponse(products: ReturnType<typeof buildMockProducts>[number][]) {
  return {
    data: {
      items: products,
      pagination: { page: 1, limit: 20, total: products.length, totalPages: 1 },
    },
  };
}

/** Respuesta API típica de categorías: puede ser array o { data: { items } } */
export function mockCategoriesApiResponse(categories: ReturnType<typeof buildMockCategories>) {
  return { data: { items: categories } };
}
