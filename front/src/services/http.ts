import type {
  ApiEnvelope,
  AdminLoginResponse,
  Category,
  BillingChangePlanResponse,
  BusinessNameAvailabilityResponse,
  BillingSelectPlanPayload,
  BillingSubscriptionCreateResponse,
  CartCheckoutResponse,
  CartCheckoutPayload,
  CartResponse,
  GuestCheckoutPayload,
  CategoriesListResponse,
  ListCategoriesParams,
  ListProductsParams,
  ListSalesParams,
  LoginPayload,
  CustomerLoginResponse,
  MercadoPagoConnectUrl,
  MercadoPagoStatus,
  PatchSaleItemsPayload,
  PaymentsCheckoutResponse,
  Plan,
  PlanMutationPayload,
  Product,
  ProductDetailResponse,
  ProductStatus,
  ProductsListResponse,
  PublicPlan,
  QueryParams,
  CreateBusinessPayload,
  RecoverPasswordPayload,
  RegisterCustomerPayload,
  ResetPasswordWithTokenPayload,
  ResetPasswordWithTokenResponse,
  Sale,
  SaleMetrics,
  Subscription,
  SuperadminPlansListResponse,
  Tenant,
  TenantCapabilitiesResponse,
  TenantResolveResponse,
  ShippingMethod,
  ShipmentQuote,
  UserMeResponse,
  ValidateResetPasswordTokenPayload,
  ValidateResetPasswordTokenResponse,
  DashboardStats,
} from '@/types';
import { normalizeCategories, normalizeCategory, normalizeProducts } from '@/lib/api-utils';
import { api } from '@/services/api';

function buildProductParams(params?: ListProductsParams): QueryParams {
  const query: QueryParams = {};
  if (!params) return query;
  if (params.page != null) query.page = String(params.page);
  if (params.limit != null) query.limit = String(params.limit);
  if (params.name) query.name = params.name;
  if (params.barCode) query.barCode = params.barCode;
  if (params.categoryId) query.categoryId = params.categoryId;
  if (params.categorySlug) query.categorySlug = params.categorySlug;
  if (params.status) query.status = params.status;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return query;
}

function buildCategoryParams(params?: ListCategoriesParams): QueryParams {
  const query: QueryParams = {};
  if (!params) return query;
  if (params.page != null) query.page = String(params.page);
  if (params.limit != null) query.limit = String(params.limit);
  if (params.name) query.name = params.name;
  return query;
}

function buildSalesParams(params?: ListSalesParams): QueryParams {
  const query: QueryParams = {};
  if (!params) return query;
  if (params.page != null) query.page = String(params.page);
  if (params.limit != null) query.limit = String(params.limit);
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return query;
}

export const http = {
  tenant: {
    resolveByUrl: (url: string) => api.get<TenantResolveResponse>('/public/tenant/resolve', { url }),
  },

  auth: {
    getMe: () => api.get<UserMeResponse>('/user/me'),
    loginAdmin: (payload: LoginPayload) => api.post<AdminLoginResponse>('/public/admin/login', payload),
    loginCustomer: (payload: LoginPayload) => api.post<CustomerLoginResponse>('/public/login', payload),
    recoverAdminPassword: (payload: RecoverPasswordPayload) => api.post('/public/admin/password/recovery', payload),
    recoverCustomerPassword: (payload: RecoverPasswordPayload) => api.post('/public/password/recovery', payload),
    registerCustomer: (payload: RegisterCustomerPayload) => api.post('/public/register', payload),
    validateResetPasswordToken: (payload: ValidateResetPasswordTokenPayload) =>
      api.post<ValidateResetPasswordTokenResponse>('/public/password/reset/validate', payload),
    resetPasswordWithToken: (payload: ResetPasswordWithTokenPayload) =>
      api.post<ResetPasswordWithTokenResponse>('/public/password/reset', payload),
  },

  business: {
    createBusiness: (payload: CreateBusinessPayload) =>
      api.post<{ status: number; message: string; data?: { tenantId: string; adminEmail: string } }>(
        '/public/platform/businesses',
        payload
      ),
    checkBusinessNameAvailability: (website: string) =>
      api.get<BusinessNameAvailabilityResponse>('/public/platform/businesses/availability', { website }),
    getAdminBusiness: () => api.get<Tenant>('/admin/business'),
    updateAdminBusiness: (formData: FormData) =>
      api.putMultipart<ApiEnvelope<{ website?: string | null }>>('/admin/business/manage', formData),
    improveSeoDescription: (payload?: {
      currentText?: string;
      businessSummary?: string;
      businessDetails?: string;
      productsOrServices?: string;
      shipsNationwide?: boolean;
      hasPhysicalStore?: boolean;
      physicalStoreLocation?: string;
    }) =>
      api.post<ApiEnvelope<{ seoDescription: string }>>('/admin/business/seo-description/improve', payload ?? {}),
  },

  categories: {
    listAdmin: async (params?: ListCategoriesParams) => {
      const response = await api.get<CategoriesListResponse>('/admin/categories', buildCategoryParams(params));
      return response.data.items;
    },
    listPublic: async (params?: ListCategoriesParams) => {
      const response = await api.get<CategoriesListResponse>('/public/categories', buildCategoryParams(params));
      return normalizeCategories(response.data.items);
    },
    getPublicBySlug: async (slug: string) => {
      const response = await api.get<ApiEnvelope<Category>>(`/public/categories/${slug}`);
      return normalizeCategory(response.data);
    },
    createAdmin: (formData: FormData) => api.postMultipart('/admin/categories', formData),
    updateAdmin: (id: string, formData: FormData) => api.putMultipart(`/admin/categories/${id}`, formData),
    deleteAdmin: (id: string) => api.delete(`/admin/categories/${id}`),
  },

  products: {
    listAdmin: async (params?: ListProductsParams) => {
      const response = await api.get<ProductsListResponse>('/admin/products', buildProductParams(params));
      return {
        items: normalizeProducts(response.data.items),
        pagination: response.data.pagination,
      };
    },
    listPublic: async (params?: ListProductsParams) => {
      const response = await api.get<ProductsListResponse>('/public/products', buildProductParams(params));
      return {
        items: normalizeProducts(response.data.items),
        pagination: response.data.pagination,
      };
    },
    getPublicBySlug: async (slug: string) => {
      const response = await api.get<ProductDetailResponse>(`/public/products/${slug}`);
      return normalizeProducts([response.data])[0] as Product;
    },
    createAdmin: (formData: FormData) => api.postMultipart('/admin/products', formData),
    updateAdmin: (id: string, formData: FormData) => api.putMultipart(`/admin/products/${id}`, formData),
    deleteAdmin: (id: string) => api.delete(`/admin/products/${id}`),
    patchBulkStatus: (ids: string[], status: ProductStatus) =>
      api.patch<{ message: string; data: { updated: number } }>('/admin/products/bulk/status', { ids, status }),
  },

  cart: {
    get: async () => {
      const response = await api.get<CartResponse>('/cart');
      return response.data;
    },
    patchItemDelta: (productId: string, delta: number) => api.patch('/cart/items', { productId, delta }),
    checkout: async (payload: CartCheckoutPayload) => {
      const formData = new FormData();
      formData.append('origin', payload.origin ?? 'cart');
      if ((payload.origin ?? 'cart') === 'sale' && payload.paymentProvider) {
        formData.append('paymentProvider', payload.paymentProvider);
      }
      if (payload.guestCheckout) {
        formData.append('name', payload.guestCheckout.name);
        formData.append('email', payload.guestCheckout.email);
        formData.append('phone', payload.guestCheckout.phone);
        formData.append('createAccountAfterPurchase', payload.guestCheckout.createAccountAfterPurchase ? 'true' : 'false');
      }
      if (payload.shippingMethodId) formData.append('shippingMethodId', payload.shippingMethodId);
      if (payload.shippingSelectionType) formData.append('shippingSelectionType', payload.shippingSelectionType);
      if (payload.shippingQuoteId) formData.append('shippingQuoteId', payload.shippingQuoteId);
      if (payload.shippingAddress) formData.append('shippingAddress', JSON.stringify(payload.shippingAddress));
      if (payload.comprobante && payload.comprobante.size > 0) formData.append('comprobante', payload.comprobante);
      const idempotencyKey = crypto.randomUUID();
      const response = await api.postMultipart<CartCheckoutResponse>('/cart/checkout', formData, {
        'Idempotency-Key': idempotencyKey,
      });
      const data = response.data as { order?: string; saleIds?: string[] };
      if (data.order) return { orderId: data.order };
      return { saleIds: data.saleIds ?? [] };
    },
  },

  shipping: {
    listMethods: async () => {
      const response = await api.get<ApiEnvelope<ShippingMethod[]>>('/admin/shipping-methods');
      return response.data;
    },
    createMethod: async (payload: Partial<ShippingMethod> & Record<string, unknown>) => {
      const response = await api.post<ApiEnvelope<ShippingMethod>>('/admin/shipping-methods', payload);
      return response.data;
    },
    updateMethod: async (id: string, payload: Partial<ShippingMethod> & Record<string, unknown>) => {
      const response = await api.put<ApiEnvelope<ShippingMethod>>(`/admin/shipping-methods/${id}`, payload);
      return response.data;
    },
    patchMethodStatus: async (id: string, isActive: boolean) => {
      const response = await api.patch<ApiEnvelope<ShippingMethod>>(`/admin/shipping-methods/${id}/status`, { isActive });
      return response.data;
    },
    deleteMethod: (id: string) => api.delete<ApiEnvelope<unknown>>(`/admin/shipping-methods/${id}`),
    quote: async (payload: { quoteType: 'HOME_DELIVERY' | 'PICKUP'; shippingAddress?: Record<string, unknown> }) => {
      const response = await api.post<ApiEnvelope<{ items: ShipmentQuote[]; packageSummary: Record<string, unknown> }>>(
        '/public/shipping/quotes',
        payload
      );
      return response.data;
    },
  },

  sales: {
    list: async (params?: ListSalesParams) => {
      const response = await api.get<ApiEnvelope<{ items: Sale[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>>(
        '/admin/sales',
        buildSalesParams(params)
      );
      return response.data;
    },
    getOne: async (id: string) => {
      const response = await api.get<ApiEnvelope<Sale>>(`/admin/sales/${id}`);
      return response.data;
    },
    getMetrics: async (from: string, to: string, groupBy: 'day' | 'week' | 'month' = 'day') => {
      const response = await api.get<ApiEnvelope<SaleMetrics>>(
        `/admin/sales/metrics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupBy=${groupBy}`
      );
      return response.data;
    },
    update: (id: string, payload: { discount?: number; status?: string }) =>
      api.put<ApiEnvelope<unknown>>(`/admin/sales/${id}`, payload),
    patchItems: (id: string, payload: PatchSaleItemsPayload) =>
      api.patch<ApiEnvelope<unknown>>(`/admin/sales/${id}/items`, payload),
    delete: (id: string) => api.delete<ApiEnvelope<unknown>>(`/admin/sales/${id}`),
    getPaymentProof: (id: string) =>
      api.get<ApiEnvelope<{ url: string }>>(`/admin/sales/${id}/payment-proof`),
    createShipment: (id: string) =>
      api.post<ApiEnvelope<Sale>>(`/admin/sales/${id}/shipment/create`),
    refreshShipment: (id: string) =>
      api.post<ApiEnvelope<Sale>>(`/admin/sales/${id}/shipment/refresh`),
    requoteShipment: (id: string) =>
      api.post<ApiEnvelope<Sale>>(`/admin/sales/${id}/shipment/requote`),
    markPickedUp: (id: string) =>
      api.post<ApiEnvelope<Sale>>(`/admin/sales/${id}/shipment/mark-picked-up`),
  },

  billing: {
    getCurrentSubscription: () => api.get<Subscription | null>('/payments/billing/subscriptions/current'),
    getCapabilities: () => api.get<TenantCapabilitiesResponse | { message: string; data: null }>('/payments/billing/capabilities'),
    listPlansForBilling: () => api.get<Plan[]>('/payments/billing/plans'),
    listPublicPlans: () => api.get<PublicPlan[]>('/public/plans'),
    createSubscription: (payload: BillingSelectPlanPayload) => {
      const idempotencyKey = crypto.randomUUID();
      return api.post<BillingSubscriptionCreateResponse>('/payments/billing/subscriptions', payload, {
        'Idempotency-Key': idempotencyKey,
      });
    },
    resumeCurrentSubscription: () =>
      api.post<BillingSubscriptionCreateResponse>('/payments/billing/subscriptions/current/resume'),
    changeCurrentPlan: (payload: BillingSelectPlanPayload) => {
      const idempotencyKey = crypto.randomUUID();
      return api.patch<BillingChangePlanResponse>('/payments/billing/subscriptions/current/plan', payload, {
        'Idempotency-Key': idempotencyKey,
      });
    },
  },

  payments: {
    getMercadoPagoStatus: () => api.get<MercadoPagoStatus>('/admin/mercadopago/status'),
    getMercadoPagoConnectUrl: () => api.get<MercadoPagoConnectUrl>('/admin/mercadopago/connect-url'),
    createCheckout: async (orderId: string) => {
      const idempotencyKey = crypto.randomUUID();
      const response = await api.post<PaymentsCheckoutResponse>(
        `/payments/checkout/${orderId}`,
        undefined,
        { 'Idempotency-Key': idempotencyKey }
      );
      return response.data;
    },
  },

  dashboard: {
    getStats: async (period: 7 | 30 = 7) => {
      const response = await api.get<ApiEnvelope<DashboardStats>>(`/admin/dashboard/stats?period=${period}`);
      return response.data;
    },
    getStatsByMonth: async (year: number, month: number) => {
      const monthStr = month.toString().padStart(2, '0');
      const response = await api.get<ApiEnvelope<DashboardStats>>(`/admin/dashboard/stats?month=${year}-${monthStr}`);
      return response.data;
    },
  },

  superadmin: {
    listPlans: async () => {
      const response = await api.get<SuperadminPlansListResponse>('/superadmin/plans');
      return response.data;
    },
    createPlan: (payload: PlanMutationPayload) => api.post('/superadmin/plans', payload),
    updatePlan: (id: string, payload: Partial<PlanMutationPayload>) => api.put(`/superadmin/plans/${id}`, payload),
    deletePlan: (id: string) => api.delete(`/superadmin/plans/${id}`),
  },
};
