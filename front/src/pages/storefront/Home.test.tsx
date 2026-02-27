import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StorefrontHome from './Home';
import {
  withRouter,
  buildMockProducts,
  buildMockCategories,
} from '@/test/test-utils';

vi.mock('@/services/http', () => ({
  http: {
    products: { listPublic: vi.fn() },
    categories: { listPublic: vi.fn() },
  },
}));

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({ tenant: { name: 'Mi Tienda' }, loading: false }),
}));

const { http } = await import('@/services/http');

describe('Storefront Home', () => {
  beforeEach(() => {
    vi.mocked(http.products.listPublic).mockReset();
    vi.mocked(http.categories.listPublic).mockReset();
  });

  it('muestra categorías con imagen y categorías sin imagen', async () => {
    const categories = buildMockCategories({ withImages: [true, false, true, false] });
    const products = buildMockProducts(2, { withImage: true });
    vi.mocked(http.products.listPublic).mockResolvedValue({ items: products, pagination: { page: 1, limit: 10, total: products.length, totalPages: 1 } });
    vi.mocked(http.categories.listPublic).mockResolvedValue(categories);

    render(withRouter(<StorefrontHome />));

    await waitFor(() => {
      expect(screen.getByText('Categoría 1')).toBeInTheDocument();
      expect(screen.getByText('Categoría 2')).toBeInTheDocument();
      expect(screen.getByText('Categoría 3')).toBeInTheDocument();
      expect(screen.getByText('Categoría 4')).toBeInTheDocument();
    });

    const categorySection = screen.getByRole('heading', { name: /categorías/i }).closest('section');
    expect(categorySection).toBeInTheDocument();
    const images = categorySection!.querySelectorAll('img');
    expect(images.length).toBe(2);
  });

  it('muestra productos destacados con imágenes', async () => {
    const products = buildMockProducts(8, { withImage: true });
    const categories = buildMockCategories({ withImages: [false] });
    vi.mocked(http.products.listPublic).mockResolvedValue({ items: products, pagination: { page: 1, limit: 10, total: products.length, totalPages: 1 } });
    vi.mocked(http.categories.listPublic).mockResolvedValue(categories);

    render(withRouter(<StorefrontHome />));

    await waitFor(() => {
      expect(screen.getByText('Productos Destacados')).toBeInTheDocument();
      expect(screen.getByText('Producto 1')).toBeInTheDocument();
      expect(screen.getByText('Producto 8')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/products/producto-')).length).toBe(8);
  });

  it('no muestra sección de categorías cuando no hay categorías', async () => {
    vi.mocked(http.products.listPublic).mockResolvedValue({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    vi.mocked(http.categories.listPublic).mockResolvedValue([]);

    render(withRouter(<StorefrontHome />));

    await waitFor(() => {
      expect(http.categories.listPublic).toHaveBeenCalled();
    });

    expect(screen.queryByText('Categoría 1')).not.toBeInTheDocument();
  });
});
