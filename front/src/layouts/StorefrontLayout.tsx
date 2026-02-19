import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShoppingCart, User, Search, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function StorefrontLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { tenant } = useTenant();
  const { itemCount } = useCart();
  const { user, isCustomer, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <button
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/" className="flex items-center gap-2">
              {tenant?.logo ? (
                <img src={tenant.logo} alt={tenant.name} className="h-8" />
              ) : (
                <span className="text-xl font-bold tracking-tight">{tenant?.name || 'PRAGMATIENDA'}</span>
              )}
            </Link>
            <nav className="hidden lg:flex items-center gap-6">
              <Link
                to="/products"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === '/products' ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                Productos
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/cart" className="relative p-2 hover:bg-accent rounded-lg transition-colors">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Link>
            {user && isCustomer ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-sm text-muted-foreground">{user.name}</span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  Salir
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Ingresar</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t animate-fade-in">
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
              <Link
                to="/products"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-sm font-medium hover:text-primary"
              >
                Productos
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t bg-secondary/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-sm font-semibold">{tenant?.name || 'PRAGMATIENDA'}</span>
            <div className="flex items-center gap-4">
              {tenant?.socialLinks?.instagram && (
                <a href={tenant.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground text-sm">
                  Instagram
                </a>
              )}
              {tenant?.socialLinks?.facebook && (
                <a href={tenant.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground text-sm">
                  Facebook
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Powered by PRAGMATIENDA
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
