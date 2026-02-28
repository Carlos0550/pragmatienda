import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StorefrontLayout } from "@/layouts/StorefrontLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { SuperAdminLayout } from "@/layouts/SuperAdminLayout";
import StorefrontHome from "@/pages/storefront/Home";
import ProductsPage from "@/pages/storefront/Products";
import ProductDetailPage from "@/pages/storefront/ProductDetail";
import CategoryProductsPage from "@/pages/storefront/CategoryProducts";
import CartPage from "@/pages/storefront/Cart";
import CheckoutPage from "@/pages/storefront/Checkout";
import CustomerProfilePage from "@/pages/storefront/Profile";
import CustomerLoginPage from "@/pages/storefront/CustomerLogin";
import CustomerRegisterPage from "@/pages/storefront/CustomerRegister";
import AdminLoginPage from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/Dashboard";
import BusinessPage from "@/pages/admin/Business";
import CategoriesPage from "@/pages/admin/Categories";
import AdminProductsPage from "@/pages/admin/Products";
import BillingPage from "@/pages/admin/Billing";
import PlansPage from "@/pages/superadmin/Plans";
import ForbiddenPage from "@/pages/ForbiddenPage";
import NotFound from "@/pages/NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<StorefrontLayout />}>
        <Route path="/" element={<StorefrontHome />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:slug" element={<ProductDetailPage />} />
        <Route path="/category/:slug" element={<CategoryProductsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute requiredRole="customer">
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<CustomerLoginPage />} />
        <Route path="/register" element={<CustomerRegisterPage />} />
      </Route>

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="business" element={<BusinessPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>

      <Route
        path="/superadmin"
        element={
          <ProtectedRoute requiredRole="superadmin">
            <SuperAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/superadmin/plans" replace />} />
        <Route path="plans" element={<PlansPage />} />
      </Route>

      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
