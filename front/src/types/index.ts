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
  data?: unknown;
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
  website?: string;
  storeUrl?: string;
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
  businessHours?: string;
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
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
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

export type ShippingMethodKind = 'THIRD_PARTY' | 'EXTERNAL' | 'PICKUP';
export type ShippingProviderCode = 'CUSTOM_EXTERNAL' | 'LOCAL_PICKUP' | 'SHIPNOW';
export type ShippingQuoteType = 'HOME_DELIVERY' | 'PICKUP';
export type OrderShipmentStatus =
  | 'DRAFT'
  | 'QUOTED'
  | 'PENDING_CREATION'
  | 'READY_FOR_PICKUP'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELED'
  | 'FAILED';

export interface ShippingAddress {
  recipientName: string;
  recipientPhone: string;
  streetName: string;
  streetNumber: string;
  floor?: string;
  apartment?: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  references?: string;
}

export interface ShippingZoneRule {
  id?: string;
  province: string;
  locality: string;
  price: number;
  isActive: boolean;
  displayName?: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  kind: ShippingMethodKind;
  providerCode: ShippingProviderCode;
  isActive: boolean;
  availableInCheckout: boolean;
  availableInAdmin: boolean;
  displayOrder: number;
  config?: Record<string, unknown>;
  zoneRules: ShippingZoneRule[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ShipmentQuote {
  id?: string;
  shippingMethodId: string;
  providerCode: ShippingProviderCode;
  kind: ShippingMethodKind;
  quoteType?: ShippingQuoteType;
  serviceCode?: string;
  serviceName?: string;
  price?: number;
  currency?: string;
  methodName: string;
  unavailableReason?: string;
  pickupDetails?: Record<string, unknown>;
}

export interface OrderShipment {
  id: string;
  status: OrderShipmentStatus;
  providerCode: ShippingProviderCode;
  kind: ShippingMethodKind;
  price: number;
  currency: string;
  serviceCode?: string;
  serviceName?: string;
  trackingCode?: string;
  labelUrl?: string;
  externalShipmentId?: string;
  destination?: Record<string, unknown>;
  pickupSnapshot?: Record<string, unknown>;
  originSnapshot?: Record<string, unknown>;
  quote?: ShipmentQuote | null;
  shippingMethod?: ShippingMethod | null;
  pickedUpAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  subscriptionId: string | null;
  externalSubscriptionId: string | null;
  initPoint?: string | null;
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

export interface BusinessNameAvailabilityResponse {
  message: string;
  data?: {
    available: boolean;
    normalizedWebsite: string;
  };
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
  website?: string;
  storeUrl?: string;
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
  businessHours?: string | null;
  country?: string | null;
  socialMedia?: SocialLinks | null;
  bankOptions?: BankOption[];
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

export interface GuestCheckoutPayload {
  name: string;
  email: string;
  phone: string;
  createAccountAfterPurchase: boolean;
}

export interface CartCheckoutPayload {
  comprobante?: File | null;
  origin?: 'cart' | 'sale';
  paymentProvider?: string;
  guestCheckout?: GuestCheckoutPayload;
  shippingMethodId?: string;
  shippingQuoteId?: string;
  shippingSelectionType?: ShippingQuoteType;
  shippingAddress?: ShippingAddress;
}

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
  discount: number;
  saleDate: string;
  createdAt: string;
  status: string;
  paymentProvider: string;
  paymentProofImage?: string | null;
  currency: string;
  orderId?: string | null;
  orderItemId?: string | null;
  order?: {
    id: string;
    createdAt: string;
    guestName?: string | null;
    guestEmail?: string | null;
    guestPhone?: string | null;
    userId?: string | null;
    user?: {
      email?: string;
      name?: string;
      createdAt?: string;
      totalOrders?: number;
    };
    items: SaleOrderItem[];
    shipment?: OrderShipment | null;
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

export interface DashboardKpis {
  revenue: number;
  revenuePrev: number;
  orders: number;
  ordersPrev: number;
  avgTicket: number;
  avgTicketPrev: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface RevenueChartPoint {
  date: string;
  total: number;
}

export interface StockAlert {
  id: string;
  name: string;
  stock: number;
  status: 'out_of_stock' | 'critical' | 'low';
}

export interface RecentOrder {
  id: string;
  number: string;
  customerName: string;
  status: string;
  fulfillmentStatus: string;
  total: number;
}

export interface TopProduct {
  id: string;
  name: string;
  totalSold: number;
}

export interface DashboardStats {
  kpis: DashboardKpis;
  revenueChart: RevenueChartPoint[];
  stockAlerts: StockAlert[];
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
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
  name: string;
  website: string;
  storeUrl: string;
  logo: string;
  banner: string;
  seoImage: string;
  favicon: string;
  address: string;
  province: string;
  businessHours: string;
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
  weightGrams?: string;
  lengthCm?: string;
  widthCm?: string;
  heightCm?: string;
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
  passwordSetupToken: string | null;
  setBillingRequired: (v: boolean) => void;
  setPasswordSetupToken: (token: string | null) => void;
  loginAdmin: (email: string, password: string) => Promise<void>;
  loginCustomer: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export interface CartState {
  cart: Cart | null;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, quantity: number) => Promise<void | ApiError>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  checkout: (payload: CartCheckoutPayload) => Promise<{ orderId: string } | { saleIds: string[] }>;
  totalCartItems: () => number;
  totalCart: () => number;
}
