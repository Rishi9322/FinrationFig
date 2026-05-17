import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
    <aside className="w-64 bg-slate-900 text-white h-screen overflow-y-auto">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-slate-400 mt-1">FinRatio Management</p>
      </div>

      <nav className="px-4 py-6">
        {adminMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
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

      <div className="absolute bottom-0 w-full p-4 border-t border-slate-700">
        <button className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
