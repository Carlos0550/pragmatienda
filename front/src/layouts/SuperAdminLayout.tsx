import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CreditCard, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const superNavItems = [
  { title: 'Planes', path: '/superadmin/plans', icon: CreditCard },
];

export function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-sidebar-primary" />
            <span className="text-lg font-bold text-sidebar-foreground">Super Admin</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {superNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive(item.path)
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <p className="px-3 mb-2 text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
          <button
            onClick={() => { logout(); navigate('/admin/login'); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 h-16 border-b bg-background/95 backdrop-blur flex items-center px-6">
          <h1 className="text-lg font-semibold">
            {superNavItems.find((i) => isActive(i.path))?.title || 'Super Admin'}
          </h1>
        </header>
        <main className="flex-1 p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
