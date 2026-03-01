import { create } from 'zustand';
import { http } from '@/services/http';
import type { CartItem, CartState } from '@/types';

export const useCartStore = create<CartState>((set) => ({
  cart: null,
  loading: false,

  fetchCart: async () => {
    set({ loading: true });
    try {
      const cart = await http.cart.get();
      console.log("cart", cart);
      set({ cart });
    } catch (error) {
      console.error("Error fetching cart", error);
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (productId: string, quantity: number) => {
    set({ loading: true });
    await http.cart.patchItemDelta(productId, quantity);
    await useCartStore.getState().fetchCart();
    set({ loading: false });
  },

  updateItem: async (productId: string, quantity: number) => {
    set({ loading: true });
    const currentItem = useCartStore.getState().cart?.items.find((item) => item.productId === productId);
    const currentQuantity = currentItem?.quantity ?? 0;
    const delta = quantity - currentQuantity;
    if (delta !== 0) {
      await http.cart.patchItemDelta(productId, delta);
      await useCartStore.getState().fetchCart();
    }
    set({ loading: false });
  },

  removeItem: async (productId: string) => {
    set({ loading: true });
    const currentItem = useCartStore.getState().cart?.items.find((item) => item.productId === productId);
    const delta = -(currentItem?.quantity ?? 0);
    if (delta !== 0) {
      await http.cart.patchItemDelta(productId, delta);
      await useCartStore.getState().fetchCart();
    }
    set({ loading: false });
  },

  checkout: async (comprobante: File) => {
    set({ loading: true });
    const result = await http.cart.checkout(comprobante);
    set({ cart: null, loading: false });
    return result;
  },

  totalCartItems: () => {
    const cart = useCartStore.getState().cart;
    return cart?.items?.reduce((sum: number, item: CartItem) => sum + item.quantity, 0) || 0;
  }, // total items in cart

  totalCart: () => {
    const cart = useCartStore.getState().cart;
    return cart?.items?.reduce((sum: number, item: CartItem) => sum + item.product.price * item.quantity, 0) || 0;
  } // total price of cart
}));

export function useCartItemCount(): number {
  const cart = useCartStore((s) => s.cart);
  return cart?.items?.reduce((sum: number, item: CartItem) => sum + item.quantity, 0) || 0;
}
