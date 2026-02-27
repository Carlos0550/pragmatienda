import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductDetailPage from './ProductDetail';

vi.mock('@/services/http', () => ({
  http: {
    products: { getPublicBySlug: vi.fn() },
  },
}));

vi.mock('@/contexts/CartContext', () => ({
  useCart: () => ({ addItem: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Test' } }),
}));

const { http } = await import('@/services/http');

function renderProductDetail(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/products/:slug" element={<ProductDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const mockProduct = (slug: string) => ({
  id: 'prod-1',
  name: 'Producto Test',
  slug,
  description: 'Descripción del producto',
  price: 1999,
  compareAtPrice: 2499,
  image: 'https://example.com/product.jpg',
  images: ['https://example.com/product.jpg'],
  categoryId: 'cat-1',
  categoryName: 'Categoría',
  stock: 5,
  active: true,
  status: 'PUBLISHED' as const,
});

describe('ProductDetailPage', () => {
  beforeEach(() => {
    vi.mocked(http.products.getPublicBySlug).mockReset();
  });

  it('muestra loading mientras carga el producto', () => {
    vi.mocked(http.products.getPublicBySlug).mockImplementation(() => new Promise(() => {}));
    renderProductDetail('/products/producto-test');

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('muestra producto con imagen cuando carga correctamente', async () => {
    vi.mocked(http.products.getPublicBySlug).mockResolvedValue(mockProduct('producto-test'));

    renderProductDetail('/products/producto-test');

    await waitFor(() => {
      expect(http.products.getPublicBySlug).toHaveBeenCalledWith('producto-test');
    });

    await waitFor(() => {
      expect(screen.getByText('Producto Test')).toBeInTheDocument();
      expect(screen.getByText(/\$\s*1[.,]999/)).toBeInTheDocument();
      const img = screen.getByRole('img', { name: 'Producto Test' });
      expect(img).toHaveAttribute('src', 'https://example.com/product.jpg');
    });
  });

  it('muestra mensaje y enlace cuando el producto no existe', async () => {
    vi.mocked(http.products.getPublicBySlug).mockRejectedValue(new Error('404'));

    renderProductDetail('/products/inexistente');

    await waitFor(() => {
      expect(screen.getByText(/Producto no encontrado/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ver productos/i })).toHaveAttribute('href', '/products');
    });
  });

  it('muestra placeholder "Sin imagen" cuando el producto no tiene imagen', async () => {
    vi.mocked(http.products.getPublicBySlug).mockResolvedValue({
      ...mockProduct('sin-imagen'),
      image: undefined,
      images: [],
    });

    renderProductDetail('/products/sin-imagen');

    await waitFor(() => {
      expect(screen.getByText('Producto Test')).toBeInTheDocument();
      expect(screen.getByText('Sin imagen')).toBeInTheDocument();
    });
  });
});
