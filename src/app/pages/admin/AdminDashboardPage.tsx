import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Users, Calculator, Activity, TrendingUp } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalCalculators: number;
  enabledCalculators: number;
  totalCalculations: number;
  avgLoginCount: number;
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard/stats');
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <h1 className="text-4xl font-bold text-slate-900">Admin Dashboard</h1>

        {loading ? (
          <div>Loading...</div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Users</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalUsers}</p>
                </div>
                <Users className="text-blue-600" size={40} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Active Users</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{stats.activeUsers}</p>
                </div>
                <Activity className="text-green-600" size={40} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Calculators</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">{stats.totalCalculators}</p>
                </div>
                <Calculator className="text-purple-600" size={40} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Enabled Calculators</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">{stats.enabledCalculators}</p>
                </div>
                <TrendingUp className="text-orange-600" size={40} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Calculations</p>
                  <p className="text-3xl font-bold text-indigo-600 mt-2">{stats.totalCalculations}</p>
                </div>
                <Activity className="text-indigo-600" size={40} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Avg Logins per User</p>
                  <p className="text-3xl font-bold text-pink-600 mt-2">{stats.avgLoginCount.toFixed(1)}</p>
                </div>
                <Users className="text-pink-600" size={40} />
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <p className="text-slate-600">Activity feed coming soon...</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                to="/admin/users"
                className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
              >
                Create User
              </Link>
              <Link
                to="/admin/calculators"
                className="block w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-center"
              >
                Enable Calculator
              </Link>
              <Link
                to="/admin/permissions"
                className="block w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-center"
              >
                Generate Report
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
