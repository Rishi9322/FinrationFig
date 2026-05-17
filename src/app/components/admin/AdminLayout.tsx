import React from 'react';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../../hooks/useAuth';
import { Navigate } from 'react-router-dom';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Check if user has admin role
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return <Navigate to="/access-denied" />;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
