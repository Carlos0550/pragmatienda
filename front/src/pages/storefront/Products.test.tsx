import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProductsPage from './Products';
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

const { http } = await import('@/services/http');

describe('ProductsPage (storefront)', () => {
  beforeEach(() => {
    vi.mocked(http.products.listPublic).mockReset();
    vi.mocked(http.categories.listPublic).mockReset();
  });

  it('muestra skeleton de carga mientras obtiene datos', () => {
    vi.mocked(http.products.listPublic).mockImplementation(() => new Promise(() => {}));
    vi.mocked(http.categories.listPublic).mockImplementation(() => new Promise(() => {}));
    render(withRouter(<ProductsPage />));
    expect(screen.getByRole('heading', { name: /productos/i })).toBeInTheDocument();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('carga y muestra muchos productos con imágenes', async () => {
    const manyProducts = buildMockProducts(25, { withImage: true });
    const categories = buildMockCategories({ withImages: [true, false] });
    vi.mocked(http.products.listPublic).mockResolvedValue({
      items: manyProducts,
      pagination: { page: 1, limit: 10, total: manyProducts.length, totalPages: 3 },
    });
    vi.mocked(http.categories.listPublic).mockResolvedValue(categories);

    render(withRouter(<ProductsPage />));

    await waitFor(() => {
      expect(http.products.listPublic).toHaveBeenCalled();
      expect(http.categories.listPublic).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/25 productos/)).toBeInTheDocument();
    });

    const productLinks = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/products/producto-'));
    expect(productLinks.length).toBe(25);

    expect(screen.getByText('Producto 1')).toBeInTheDocument();
    expect(screen.getByText('Producto 25')).toBeInTheDocument();
  });

  it('muestra productos sin imagen con placeholder (ícono)', async () => {
    const productsSinImg = buildMockProducts(3, { withImage: false });
    const categories = buildMockCategories({ withImages: [false] });
    vi.mocked(http.products.listPublic).mockResolvedValue({
      items: productsSinImg,
      pagination: { page: 1, limit: 10, total: productsSinImg.length, totalPages: 1 },
    });
    vi.mocked(http.categories.listPublic).mockResolvedValue(categories);

    render(withRouter(<ProductsPage />));

    await waitFor(() => {
      expect(screen.getByText(/3 productos/)).toBeInTheDocument();
    });

    const grid = document.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(screen.getByText('Producto 1')).toBeInTheDocument();
  });

  it('lista categorías en el sidebar y filtra por categoría al hacer clic', async () => {
    const productsCat1 = buildMockProducts(2, { categoryId: 'cat-1', withImage: true });
    const categories = buildMockCategories({ withImages: [true, false] });
    vi.mocked(http.products.listPublic).mockImplementation((params?: { categoryId?: string }) => {
      if (params?.categoryId === 'cat-2') {
        return Promise.resolve({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
      }
      return Promise.resolve({ items: productsCat1, pagination: { page: 1, limit: 10, total: productsCat1.length, totalPages: 1 } });
    });
    vi.mocked(http.categories.listPublic).mockResolvedValue(categories);

    render(withRouter(<ProductsPage />, { initialEntries: ['/products'] }));

    await waitFor(() => {
      expect(screen.getByText('Categoría 1')).toBeInTheDocument();
      expect(screen.getByText('Categoría 2')).toBeInTheDocument();
    });

    const cat2Button = screen.getByRole('button', { name: 'Categoría 2' });
    fireEvent.click(cat2Button);

    await waitFor(() => {
      expect(http.products.listPublic).toHaveBeenCalledWith({ categoryId: 'cat-2' });
    });
  });

  it('muestra mensaje cuando no hay productos', async () => {
    vi.mocked(http.products.listPublic).mockResolvedValue({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    vi.mocked(http.categories.listPublic).mockResolvedValue([]);

    render(withRouter(<ProductsPage />));

    await waitFor(() => {
      expect(screen.getByText(/No se encontraron productos/)).toBeInTheDocument();
    });
  });
});
