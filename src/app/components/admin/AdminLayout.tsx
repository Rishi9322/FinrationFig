import React from 'react';
import { AdminSidebar } from './AdminSidebar';
import { getCurrentUser, canAccessAdmin } from '../../../lib/auth';
import { Navigate } from 'react-router';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();

  if (!canAccessAdmin(user)) {
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
