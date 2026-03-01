import { api } from '@/services/api';
import { normalizeCategories, normalizeCategory, normalizeProducts } from '@/lib/api-utils';
import type {
  ApiEnvelope,
  AdminLoginResponse,
  Category,
  BillingChangePlanResponse,
  BillingSelectPlanPayload,
  BillingSubscriptionCreateResponse,
  CartCheckoutResponse,
  CartResponse,
  CategoriesListResponse,
  ListCategoriesParams,
  ListProductsParams,
  LoginPayload,
  CustomerLoginResponse,
  MercadoPagoConnectUrl,
  MercadoPagoStatus,
  PaymentsCheckoutResponse,
  Plan,
  PlanMutationPayload,
  Product,
  ProductDetailResponse,
  ProductStatus,
  ProductsListResponse,
  PublicPlan,
  QueryParams,
  RecoverPasswordPayload,
  RegisterCustomerPayload,
  Subscription,
  SuperadminPlansListResponse,
  Tenant,
  TenantResolveResponse,
  UserMeResponse,
} from '@/types';

function buildProductParams(params?: ListProductsParams): QueryParams {
  const query: QueryParams = {};
  if (!params) return query;
  if (params.page != null) query.page = String(params.page);
  if (params.limit != null) query.limit = String(params.limit);
  if (params.name) query.name = params.name;
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
  },

  business: {
    getAdminBusiness: () => api.get<Tenant>('/admin/business'),
    updateAdminBusiness: (formData: FormData) => api.putMultipart('/admin/business/manage', formData),
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
    checkout: async (comprobante: File) => {
      const formData = new FormData();
      formData.append('comprobante', comprobante);
      const idempotencyKey = crypto.randomUUID();
      const response = await api.postMultipart<CartCheckoutResponse>('/cart/checkout', formData, {
        'Idempotency-Key': idempotencyKey,
      });
      return { orderId: response.data.order };
    },
  },

  billing: {
    getCurrentSubscription: () => api.get<Subscription>('/payments/billing/subscriptions/current'),
    listPlansForBilling: () => api.get<Plan[]>('/payments/billing/plans'),
    listPublicPlans: () => api.get<PublicPlan[]>('/public/plans'),
    createSubscription: (payload: BillingSelectPlanPayload) =>
      api.post<BillingSubscriptionCreateResponse>('/payments/billing/subscriptions', payload),
    changeCurrentPlan: (payload: BillingSelectPlanPayload) =>
      api.patch<BillingChangePlanResponse>('/payments/billing/subscriptions/current/plan', payload),
  },

  payments: {
    getMercadoPagoStatus: () => api.get<MercadoPagoStatus>('/admin/mercadopago/status'),
    getMercadoPagoConnectUrl: () => api.get<MercadoPagoConnectUrl>('/admin/mercadopago/connect-url'),
    createCheckout: async (orderId: string) => {
      const response = await api.post<PaymentsCheckoutResponse>(`/payments/checkout/${orderId}`);
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
