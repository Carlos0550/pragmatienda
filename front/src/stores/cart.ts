import { create } from 'zustand';
import { api } from '@/services/api';
import type { Cart, CartItem } from '@/types';

interface CartState {
  cart: Cart | null;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, quantity: number) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  checkout: (comprobante: File) => Promise<{ orderId: string }>;
}

export const useCartStore = create<CartState>((set) => ({
  cart: null,
  loading: false,

  fetchCart: async () => {
    set({ loading: true });
    try {
      const data = await api.get<Cart>('/cart');
      set({ cart: data });
    } catch {
      // Cart might not exist yet
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (productId: string, quantity: number) => {
    set({ loading: true });
    const data = await api.patch<Cart>('/cart/items', { productId, quantity });
    set({ cart: data, loading: false });
  },

  updateItem: async (productId: string, quantity: number) => {
    set({ loading: true });
    const data = await api.patch<Cart>('/cart/items', { productId, quantity });
    set({ cart: data, loading: false });
  },

  removeItem: async (productId: string) => {
    set({ loading: true });
    const data = await api.patch<Cart>('/cart/items', { productId, quantity: 0 });
    set({ cart: data, loading: false });
  },

  checkout: async (comprobante: File) => {
    set({ loading: true });
    const formData = new FormData();
    formData.append('comprobante', comprobante);
    const res = await api.postMultipart<{ orderId: string }>('/cart/checkout', formData);
    set({ cart: null, loading: false });
    return res;
  },
}));

export function useCartItemCount(): number {
  const cart = useCartStore((s) => s.cart);
  return cart?.items?.reduce((sum: number, item: CartItem) => sum + item.quantity, 0) || 0;
}
