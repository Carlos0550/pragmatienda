import type { ReactNode } from 'react';
import type { NavLinkProps } from 'react-router-dom';

export type QueryParams = { [key: string]: string };
export type ApiFieldErrors = { [field: string]: string[] };
export type FormErrors = { [field: string]: string };
export type RoleGuard = 'admin' | 'superadmin' | 'customer';

export interface ApiError {
  status: number;
  message: string;
  errors?: ApiFieldErrors;
}

export type ApiRequestBody =
  | object
  | string
  | number
  | boolean
  | null
  | undefined;

export interface ApiEnvelope<TData> {
  status: number;
  message: string;
  data: TData;
  err?: string | ApiFieldErrors;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedData<TItem> {
  items: TItem[];
  pagination: PaginationMeta;
}

export type PaginatedResponse<TItem> = ApiEnvelope<PaginatedData<TItem>>;

export interface BankOption {
  bankName: string;
  recipientName: string;
  aliasCvuCbu: string;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  whatsapp?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  banner?: string;
  favicon?: string;
  socialLinks?: SocialLinks;
  bankOptions?: BankOption[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: number;
  phone?: string;
  avatar?: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
}

export type AuthUser = (User | Customer) & { type: 'admin' | 'customer' };

export interface CategoryRef {
  id: string;
  name: string;
}

export type ProductStatus = 'PUBLISHED' | 'UNPUBLISHED' | 'DELETED' | 'ARCHIVED' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  image?: string;
  images: string[];
  categoryId?: string;
  categoryName?: string;
  category?: CategoryRef;
  stock: number;
  active: boolean;
  status?: ProductStatus;
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
  code?: string;
  name: string;
  price: number;
  currency?: string;
  interval: string;
  description?: string;
  trialDays?: number;
  features: string[];
  active: boolean;
  productLimit?: number;
}

export interface PublicPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  description?: string;
  trialDays: number;
}

export interface Subscription {
  id: string;
  planId: string;
  plan: Plan;
  status: string;
  currentPeriodEnd: string;
}

export interface BillingSubscriptionCreateData {
  subscriptionId: string | null;
  externalSubscriptionId: string | null;
  initPoint?: string;
}

export interface BillingChangePlanData {
  subscriptionId: string;
  externalSubscriptionId: string;
}

export interface MercadoPagoStatus {
  connected: boolean;
}

export interface MercadoPagoConnectUrl {
  authorizationUrl: string;
}

export interface PaymentsCheckoutData {
  externalReference: string;
  checkoutUrl: string;
  preferenceId: string;
}

export interface ListProductsParams {
  page?: number;
  limit?: number;
  name?: string;
  categoryId?: string;
  sortBy?: 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ListCategoriesParams {
  page?: number;
  limit?: number;
  name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RecoverPasswordPayload {
  email: string;
}

export interface RegisterCustomerPayload {
  name: string;
  email: string;
  phone?: string;
}

export interface BillingSelectPlanPayload {
  planId: string;
}

export interface PlanMutationPayload {
  name: string;
  price: number;
  interval: string;
  features: string[];
  active: boolean;
  productLimit?: number;
}

export interface UserMeResponse {
  result: ApiEnvelope<User>;
}

export interface CustomerLoginResponse {
  result: ApiEnvelope<{ token: string }>;
}

export type AdminLoginResponse = ApiEnvelope<{ token: string }>;
export type TenantResolveResponse = ApiEnvelope<{ tenantId: string; businessName: string }>;
export type ProductsListResponse = PaginatedResponse<Product>;
export type ProductDetailResponse = ApiEnvelope<Product>;
export type CategoriesListResponse = PaginatedResponse<Category>;
export type BillingSubscriptionCreateResponse = { message: string; data: BillingSubscriptionCreateData };
export type BillingChangePlanResponse = { message: string; data: BillingChangePlanData };
export type PaymentsCheckoutResponse = { message: string; data: PaymentsCheckoutData };
export type SuperadminPlansListResponse = { data: Plan[] };
export type CartResponse = ApiEnvelope<Cart>;
export type CartItemPatchResponse = ApiEnvelope<{ id?: string; quantity: number; productId?: string }>;
export type CartCheckoutResponse = ApiEnvelope<{ order: string }>;

export interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: RoleGuard;
}

export type NavLinkCompatProps = Omit<NavLinkProps, 'className'> & {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
};

export interface BusinessFormState {
  logo: string;
  banner: string;
  favicon: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  bankOptions: BankOption[];
}

export interface BusinessPreviewsState {
  logo: string;
  banner: string;
  favicon: string;
}

export interface CategoryFormState {
  name: string;
  image: string;
}

export interface ProductFormState {
  name: string;
  price: string;
  categoryId: string;
  stock: string;
  active: boolean;
}

export interface PlanFormState {
  name: string;
  price: string;
  interval: string;
  features: string;
  active: boolean;
  productLimit: string;
}

export interface CustomerRegisterFormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
}

export interface TenantState {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  isLandingDomain: boolean;
  storeNotFound: boolean;
  resolveTenant: () => Promise<void>;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  billingRequired: boolean;
  setBillingRequired: (v: boolean) => void;
  loginAdmin: (email: string, password: string) => Promise<void>;
  loginCustomer: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export interface CartState {
  cart: Cart | null;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, quantity: number) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  checkout: (comprobante: File) => Promise<{ orderId: string }>;
}
