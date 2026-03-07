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
  suggestions?: string[];
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

export interface BusinessBanner {
  url: string;
  order: number;
  objectPositionX?: number;
  objectPositionY?: number;
}

export type BannerOverlayPosition =
  | 'bottom-left' | 'bottom-right' | 'bottom-center'
  | 'top-left' | 'top-right' | 'top-center'
  | 'center';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  banner?: string;
  banners?: BusinessBanner[];
  bannerOverlayPosition?: BannerOverlayPosition;
  seoImage?: string;
  favicon?: string;
  description?: string;
  seoDescription?: string;
  address?: string;
  province?: string;
  country?: string;
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
  barCode?: string | null;
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
  metaTitle?: string;
  metaDescription?: string;
  /** SEO desde API (metadata JSON) */
  metadata?: { title?: string; description?: string; keywords?: string };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  productCount?: number;
  metaTitle?: string;
  metaDescription?: string;
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
  /** Objeto feature -> habilitado (backend). Para compatibilidad puede venir como string[] en respuestas antiguas. */
  features: Record<string, boolean> | string[];
  active: boolean;
  maxProducts?: number | null;
  maxCategories?: number | null;
  /** @deprecated Usar maxProducts */
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
  currentPeriodEnd: string | null;
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

/** Respuesta de GET /payments/billing/capabilities */
export interface TenantCapabilitiesResponse {
  planCode: string;
  planId: string;
  maxProducts: number | null;
  maxCategories: number | null;
  features: Record<string, boolean>;
  usage: {
    productsCount: number;
    categoriesCount: number;
  };
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
  barCode?: string;
  categoryId?: string;
  categorySlug?: string;
  status?: ProductStatus;
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
  password: string;
  passwordConfirmation: string;
}

export interface ValidateResetPasswordTokenPayload {
  token: string;
}

export interface ResetPasswordWithTokenPayload {
  token: string;
  newPassword: string;
  newPasswordConfirmation: string;
}

export type PasswordTokenPurpose = 'PASSWORD_RESET' | 'ACCOUNT_SETUP';

export interface ValidateResetPasswordTokenData {
  tenantId: string;
  role: number;
  purpose: PasswordTokenPurpose;
}

export interface CreateBusinessPayload {
  name: string;
  phone: string;
  address?: string;
  province?: string;
  adminEmail: string;
  adminName: string;
}

export interface BillingSelectPlanPayload {
  planId: string;
}

export interface PlanMutationPayload {
  code?: 'FREE' | 'STARTER' | 'PRO';
  name: string;
  price: number;
  interval?: string;
  trialDays?: number;
  active?: boolean;
  maxProducts?: number | null;
  maxCategories?: number | null;
  features?: Record<string, boolean> | null;
}

export interface UserMeResponse {
  result: ApiEnvelope<User>;
}

export interface CustomerLoginResponse {
  result: ApiEnvelope<{ token: string }>;
}

export type AdminLoginResponse = ApiEnvelope<{ token: string }>;
export type TenantResolveResponse = ApiEnvelope<{
  tenantId: string;
  businessName: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  banners?: BusinessBanner[] | null;
  bannerOverlayPosition?: string | null;
  favicon?: string | null;
  seoImage?: string | null;
  seoDescription?: string | null;
  address?: string | null;
  province?: string | null;
  country?: string | null;
  socialMedia?: SocialLinks | null;
}>;
export type ProductsListResponse = PaginatedResponse<Product>;
export type ProductDetailResponse = ApiEnvelope<Product>;
export type CategoriesListResponse = PaginatedResponse<Category>;
export type ValidateResetPasswordTokenResponse = {
  status: number;
  message: string;
  data?: ValidateResetPasswordTokenData;
};
export type ResetPasswordWithTokenResponse = {
  status: number;
  message: string;
};
export type BillingSubscriptionCreateResponse = { message: string; data: BillingSubscriptionCreateData };
export type BillingChangePlanResponse = { message: string; data: BillingChangePlanData };
export type PaymentsCheckoutResponse = { message: string; data: PaymentsCheckoutData };
export type SuperadminPlansListResponse = { data: Plan[] };
export type CartResponse = ApiEnvelope<Cart>;
export type CartItemPatchResponse = ApiEnvelope<{ id?: string; quantity: number; productId?: string }>;
export type CartCheckoutResponse = ApiEnvelope<{ order: string } | { saleIds: string[] }>;

export type PaymentProvider = 'MERCADOPAGO_INTEGRATION' | 'BANK_TRANSFER' | 'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'OTHER';

export interface SaleItemProduct {
  id: string;
  name: string;
  image?: string | null;
  stock?: number;
}

export interface SaleOrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  product: SaleItemProduct;
}

export interface Sale {
  id: string;
  total: number;
  saleDate: string;
  status: string;
  paymentProvider: string;
  currency: string;
  orderId?: string | null;
  orderItemId?: string | null;
  order?: {
    id: string;
    user?: { email?: string; name?: string };
    items: SaleOrderItem[];
  } | null;
  orderItem?: {
    id: string;
    quantity: number;
    unitPrice: number;
    product: SaleItemProduct;
  } | null;
}

export interface SaleMetricsPoint {
  date: string;
  total: number;
}

export interface SaleMetrics {
  series: SaleMetricsPoint[];
}

export interface ListSalesParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  sortBy?: 'saleDate' | 'total' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PatchSaleItemsPayload {
  removeItemIds?: string[];
  replaceItems?: { orderItemId: string; productId: string; quantity: number }[];
}

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
  seoImage: string;
  favicon: string;
  address: string;
  province: string;
  seoDescription: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  banners: BusinessBanner[];
  bankOptions: BankOption[];
  bannerOverlayPosition: BannerOverlayPosition | '';
}

export interface BusinessPreviewsState {
  logo: string;
  banner: string;
  seoImage: string;
  favicon: string;
}

export interface CategoryFormState {
  name: string;
  image: string;
}

export interface ProductFormState {
  name: string;
  price: string;
  barCode: string;
  categoryId: string;
  stock: string;
  status: ProductStatus;
  /** Solo al editar */
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export interface PlanFormState {
  code: string;
  name: string;
  price: string;
  interval: string;
  trialDays: string;
  features: string;
  active: boolean;
  maxProducts: string;
  maxCategories: string;
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
  resolveTenantByHostname: (hostname: string) => Promise<void>;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  billingRequired: boolean;
  setBillingRequired: (v: boolean) => void;
  loginAdmin: (email: string, password: string) => Promise<void>;
  loginCustomer: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export interface CartState {
  cart: Cart | null;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, quantity: number) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  checkout: (comprobante: File) => Promise<{ orderId: string }>;
  totalCartItems: () => number;
  totalCart: () => number;
}
