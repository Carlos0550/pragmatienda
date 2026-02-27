import { useEffect } from "react";
import { Toaster } from "sileo";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTenantStore } from "@/stores/tenant";
import { useAuthStore } from "@/stores/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Layouts
import { StorefrontLayout } from "@/layouts/StorefrontLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { SuperAdminLayout } from "@/layouts/SuperAdminLayout";

// Storefront
import StorefrontHome from "@/pages/storefront/Home";
import ProductsPage from "@/pages/storefront/Products";
import ProductDetailPage from "@/pages/storefront/ProductDetail";
import CartPage from "@/pages/storefront/Cart";
import CheckoutPage from "@/pages/storefront/Checkout";
import CustomerProfilePage from "@/pages/storefront/Profile";
import CustomerLoginPage from "@/pages/storefront/CustomerLogin";
import CustomerRegisterPage from "@/pages/storefront/CustomerRegister";

// Admin
import AdminLoginPage from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/Dashboard";
import BusinessPage from "@/pages/admin/Business";
import CategoriesPage from "@/pages/admin/Categories";
import AdminProductsPage from "@/pages/admin/Products";
import BillingPage from "@/pages/admin/Billing";

// SuperAdmin
import PlansPage from "@/pages/superadmin/Plans";

// Error
import ForbiddenPage from "@/pages/ForbiddenPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  useEffect(() => {
    void (async () => {
      await useTenantStore.getState().resolveTenant();
      await useAuthStore.getState().hydrate();
    })();
  }, []);

  return (
    <Routes>
      {/* Storefront */}
      <Route element={<StorefrontLayout />}>
        <Route path="/" element={<StorefrontHome />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:slug" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={
          <ProtectedRoute requiredRole="customer"><CheckoutPage /></ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute requiredRole="customer"><CustomerProfilePage /></ProtectedRoute>
        } />
        <Route path="/login" element={<CustomerLoginPage />} />
        <Route path="/register" element={<CustomerRegisterPage />} />
      </Route>

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="business" element={<BusinessPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>

      {/* SuperAdmin */}
      <Route path="/superadmin" element={
        <ProtectedRoute requiredRole="superadmin"><SuperAdminLayout /></ProtectedRoute>
      }>
        <Route index element={<Navigate to="/superadmin/plans" replace />} />
        <Route path="plans" element={<PlansPage />} />
      </Route>

      {/* Errors */}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster
        position="top-right"
        options={{
          fill: '#1a1a1a',
          styles: {
            title: 'text-white font-semibold opacity-100!',
            description: 'text-white opacity-90!',
          },
          duration: 2500,
        }}
      />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
