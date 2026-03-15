import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductDetailPage from '@/pages/storefront/ProductDetail';
import { withRoute } from '../../utils/test-utils';

const { mockAddItem, cartState } = vi.hoisted(() => ({
  mockAddItem: vi.fn(),
  cartState: {
    cart: null as null | {
      id: string;
      items: Array<{
        id: string;
        productId: string;
        quantity: number;
        product: { id: string; name: string; price: number; stock: number; images?: string[] };
      }>;
      total: number;
    },
    loading: false,
  },
}));

vi.mock('@/services/http', () => ({
  http: {
    products: { getPublicBySlug: vi.fn() },
  },
}));

vi.mock('@/contexts/CartContext', () => ({
  useCart: () => ({ cart: cartState.cart, addItem: mockAddItem, loading: cartState.loading }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Test' } }),
}));

const { http } = await import('@/services/http');

function renderProductDetail(entry: string) {
  return render(
    withRoute('/products/:slug', <ProductDetailPage />, {
      initialEntries: [entry],
    })
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
    mockAddItem.mockReset();
    cartState.cart = null;
    cartState.loading = false;
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

  it('deshabilita agregar al carrito cuando el carrito ya tiene todo el stock', async () => {
    vi.mocked(http.products.getPublicBySlug).mockResolvedValue({
      ...mockProduct('producto-test'),
      stock: 2,
    });
    cartState.cart = {
      id: 'cart-1',
      total: 3998,
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          quantity: 2,
          product: { id: 'prod-1', name: 'Producto Test', price: 1999, stock: 2, images: ['https://example.com/product.jpg'] },
        },
      ],
    };

    renderProductDetail('/products/producto-test');

    await waitFor(() => {
      expect(screen.getByText('Producto sin stock')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /agregar al carrito/i })).not.toBeInTheDocument();
  });

  it('clampa la cantidad seleccionada cuando baja el stock remanente del carrito', async () => {
    vi.mocked(http.products.getPublicBySlug).mockResolvedValue(mockProduct('producto-test'));

    const view = renderProductDetail('/products/producto-test');

    await waitFor(() => {
      expect(screen.getByText('Producto Test')).toBeInTheDocument();
      expect(screen.getByText('5 disponibles')).toBeInTheDocument();
    });

    const quantityValue = screen.getByText('1');
    const quantityControls = quantityValue.closest('div');
    const incrementButton = quantityControls?.querySelectorAll('button')[1];

    fireEvent.click(incrementButton!);
    fireEvent.click(incrementButton!);
    fireEvent.click(incrementButton!);

    expect(screen.getByText('4')).toBeInTheDocument();

    cartState.cart = {
      id: 'cart-1',
      total: 7996,
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          quantity: 4,
          product: { id: 'prod-1', name: 'Producto Test', price: 1999, stock: 5, images: ['https://example.com/product.jpg'] },
        },
      ],
    };

    view.rerender(
      withRoute('/products/:slug', <ProductDetailPage />, {
        initialEntries: ['/products/producto-test'],
      })
    );

    await waitFor(() => {
      expect(screen.getByText('1 disponibles')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });
});
