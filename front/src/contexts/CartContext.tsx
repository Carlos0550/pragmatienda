// Re-exports from store for backward compatibility
import { useCartStore, useCartItemCount } from '@/stores/cart';

export function useCart() {
  const cart = useCartStore((s) => s.cart);
  const loading = useCartStore((s) => s.loading);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const addItem = useCartStore((s) => s.addItem);
  const updateItem = useCartStore((s) => s.updateItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const checkout = useCartStore((s) => s.checkout);
  const itemCount = useCartItemCount();
  const totalCartItems = useCartStore((s) => s.totalCartItems());
  const totalCart = useCartStore((s) => s.totalCart());
  return {
    cart,
    itemCount,
    loading,
    fetchCart,
    addItem,
    updateItem,
    removeItem,
    checkout,
    totalCartItems,
    totalCart,
  };
}
