import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CartPage from '@/pages/storefront/Cart';
import { withRouter } from '../../utils/test-utils';

const { mockFetchCart, mockUpdateItem, mockRemoveItem, cartState } = vi.hoisted(() => ({
  mockFetchCart: vi.fn(),
  mockUpdateItem: vi.fn(),
  mockRemoveItem: vi.fn(),
  cartState: {
    cart: null as null | {
      id: string;
      total: number;
      items: Array<{
        id: string;
        productId: string;
        quantity: number;
        product: { id: string; name: string; price: number; stock: number; images?: string[] };
      }>;
    },
    loading: false,
  },
}));

vi.mock('@/contexts/CartContext', () => ({
  useCart: () => ({
    cart: cartState.cart,
    loading: cartState.loading,
    fetchCart: mockFetchCart,
    updateItem: mockUpdateItem,
    removeItem: mockRemoveItem,
    totalCartItems: cartState.cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    totalCart: cartState.cart?.total ?? 0,
  }),
}));

describe('CartPage', () => {
  beforeEach(() => {
    mockFetchCart.mockReset();
    mockUpdateItem.mockReset();
    mockRemoveItem.mockReset();
    cartState.loading = false;
    cartState.cart = {
      id: 'cart-1',
      total: 1999,
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          quantity: 2,
          product: {
            id: 'prod-1',
            name: 'Producto Test',
            price: 1999,
            stock: 2,
            images: ['https://example.com/product.jpg'],
          },
        },
      ],
    };
  });

  it('deshabilita el incremento cuando la cantidad en carrito alcanza el stock del producto', async () => {
    render(withRouter(<CartPage />));

    await waitFor(() => {
      expect(screen.getByText(/Tu Carrito/i)).toBeInTheDocument();
    });

    const quantityValue = screen.getByText('2');
    const quantityControls = quantityValue.closest('div');
    const incrementButton = quantityControls?.querySelectorAll('button')[1];

    expect(incrementButton).toBeDisabled();
  });
});
