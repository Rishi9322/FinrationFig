import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { signout } from '../../../lib/auth';
import {
  LayoutDashboard,
  Users,
  Calculator,
  Settings,
  BarChart3,
  Shield,
  LogOut,
} from 'lucide-react';

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await signout();
    } catch {
      // Ignore logout API failures and force local logout UX.
    }
    toast.success('Signed out successfully');
    navigate('/auth/signin');
  }

  const adminMenuItems = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      icon: Users,
      label: 'Users',
      href: '/admin/users',
    },
    {
      icon: Calculator,
      label: 'Calculators',
      href: '/admin/calculators',
    },
    {
      icon: BarChart3,
      label: 'Calculations',
      href: '/admin/calculations',
    },
    {
      icon: Shield,
      label: 'Permissions',
      href: '/admin/permissions',
    },
    {
      icon: Settings,
      label: 'Settings',
      href: '/admin/settings',
    },
  ];

  return (
    /* Column layout with an mt-auto footer: the logout block sits at the bottom
       without `absolute`, which previously had no positioned ancestor and so
       stretched across the whole page instead of the sidebar. */
    <aside className="w-64 shrink-0 bg-slate-900 text-white h-screen flex flex-col">
      <div className="p-6 shrink-0">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-slate-400 mt-1">FinRatio Management</p>
      </div>

      <nav className="px-4 py-6 flex-1 overflow-y-auto">
        {adminMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 p-4 border-t border-slate-700">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
