import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'superadmin' | 'customer';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, isAdmin, isSuperAdmin, isCustomer } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    if (requiredRole === 'admin' || requiredRole === 'superadmin') {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'superadmin' && !isSuperAdmin) {
    return <Navigate to="/403" replace />;
  }

  if (requiredRole === 'admin' && !isAdmin) {
    return <Navigate to="/403" replace />;
  }

  if (requiredRole === 'customer' && !isCustomer) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
