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
  // Compute totalCartItems as a reactive value based on cart
  const totalCartItems = cart?.items?.reduce((sum: number, item) => sum + item.quantity, 0) || 0;
  // Compute totalCart as a reactive value based on cart
  const totalCart = cart?.items?.reduce((sum: number, item) => sum + (item.product?.price ?? 0) * item.quantity, 0) || 0;
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
