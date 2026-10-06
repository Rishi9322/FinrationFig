import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import { getCurrentUser, canAccessAdmin } from '../../../lib/auth';
import { Navigate, useLocation } from 'react-router';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the drawer after navigating, so the page isn't hidden behind it.
  useEffect(() => setOpen(false), [pathname]);

  if (!canAccessAdmin(user)) {
    return <Navigate to="/access-denied" />;
  }

  return (
    // h-dvh, not h-screen: on phones 100vh is taller than the visible area (browser bars).
    <div className="flex h-dvh bg-slate-50">
      {/* Phones and narrow foldables: the sidebar is a slide-in drawer. From md up it is a normal column. */}
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminSidebar />
      </div>
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 bg-slate-900 text-white px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="inline-flex items-center justify-center min-h-10 min-w-10 -ml-2 rounded-lg hover:bg-slate-800"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span className="font-semibold">Admin Panel</span>
        </div>
        <div className="p-4 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
