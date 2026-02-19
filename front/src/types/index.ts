export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  banner?: string;
  favicon?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: number; // 1 = admin, 9 = superadmin
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  categoryId: string;
  categoryName?: string;
  stock: number;
  active: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  productCount?: number;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
}

export interface Order {
  id: string;
  status: string;
  total: number;
  items: CartItem[];
  createdAt: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  active: boolean;
  productLimit?: number;
}

export interface Subscription {
  id: string;
  planId: string;
  plan: Plan;
  status: string;
  currentPeriodEnd: string;
}
