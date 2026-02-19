import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { api } from '@/services/api';
import type { Cart, CartItem } from '@/types';

interface CartContextType {
  cart: Cart | null;
  itemCount: number;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, quantity: number) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  checkout: (comprobante: File) => Promise<{ orderId: string }>;
}

const CartContext = createContext<CartContextType>({
  cart: null,
  itemCount: 0,
  loading: false,
  fetchCart: async () => {},
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
  checkout: async () => ({ orderId: '' }),
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Cart>('/cart');
      setCart(data);
    } catch {
      // Cart might not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  const addItem = useCallback(async (productId: string, quantity: number) => {
    setLoading(true);
    const data = await api.patch<Cart>('/cart/items', { productId, quantity });
    setCart(data);
    setLoading(false);
  }, []);

  const updateItem = useCallback(async (productId: string, quantity: number) => {
    setLoading(true);
    const data = await api.patch<Cart>('/cart/items', { productId, quantity });
    setCart(data);
    setLoading(false);
  }, []);

  const removeItem = useCallback(async (productId: string) => {
    setLoading(true);
    const data = await api.patch<Cart>('/cart/items', { productId, quantity: 0 });
    setCart(data);
    setLoading(false);
  }, []);

  const checkout = useCallback(async (comprobante: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('comprobante', comprobante);
    const res = await api.postMultipart<{ orderId: string }>('/cart/checkout', formData);
    setCart(null);
    setLoading(false);
    return res;
  }, []);

  const itemCount = cart?.items?.reduce((sum: number, item: CartItem) => sum + item.quantity, 0) || 0;

  return (
    <CartContext.Provider value={{ cart, itemCount, loading, fetchCart, addItem, updateItem, removeItem, checkout }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
