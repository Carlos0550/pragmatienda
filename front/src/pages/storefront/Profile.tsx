import React from 'react';
import { Link } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function CustomerProfilePage() {
  const { user, logout } = useAuth();

  if (!user || user.type !== 'customer') {
    return null;
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-xl border bg-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Mi perfil</h1>
            <p className="text-sm text-muted-foreground">Gestioná tu sesión</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <p><span className="font-medium">Nombre:</span> {user.name}</p>
          {'email' in user && <p><span className="font-medium">Email:</span> {user.email}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/cart">Ver carrito</Link>
          </Button>
          <Button variant="ghost" className="gap-2" onClick={logout}>
            <LogOut className="h-4 w-4" /> Salir
          </Button>
        </div>
      </div>
    </div>
  );
}
