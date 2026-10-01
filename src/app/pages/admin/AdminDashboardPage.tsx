import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Users, Calculator, FileUp, MessageSquare } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { getAdminAnalytics, AdminAnalytics } from '../../../lib/adminAnalytics';

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: React.ReactNode; hint?: string; icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between">
      <div>
        <p className="text-slate-600 text-sm font-medium">{label}</p>
        <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      </div>
      <Icon className="text-blue-600" size={36} />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">{title}</h2>
      <div className="h-64">{children}</div>
    </div>
  );
}

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminAnalytics()
      .then(setData)
      .catch((err) => toast.error(err.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  const t = data?.totals;
  // Chart both series on one date axis.
  const activity = data?.signupsByDay.map((s, i) => ({
    date: s.date.slice(5),
    signups: s.count,
    calculations: data.calculationsByDay[i]?.count ?? 0,
  }));

  return (
    <AdminLayout>
      <div className="space-y-8">
        <h1 className="text-4xl font-bold text-slate-900">Admin Dashboard</h1>

        {loading ? (
          <div>Loading...</div>
        ) : !data || !t ? (
          <p className="text-slate-600">Analytics unavailable.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Users" value={t.users} hint={`${t.suspendedUsers} suspended`} icon={Users} />
              <StatCard label="Calculations" value={t.calculations} icon={Calculator} />
              <StatCard label="Uploads" value={t.uploads} icon={FileUp} />
              <StatCard label="Feedback" value={t.feedback} hint={t.avgRating ? `avg rating ${t.avgRating}/5` : 'no ratings yet'} icon={MessageSquare} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel title="Last 30 days">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={11} interval={4} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="signups" stroke="#2563eb" dot={false} />
                    <Line type="monotone" dataKey="calculations" stroke="#16a34a" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Calculations by calculator">
                {data.calculationsByType.length === 0 ? (
                  <p className="text-slate-600 text-sm">No calculations yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.calculationsByType} layout="vertical" margin={{ left: 24 }}>
                      <XAxis type="number" allowDecimals={false} fontSize={11} />
                      <YAxis type="category" dataKey="name" fontSize={11} width={90} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#7c3aed" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>
            </div>
          </>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link to="/admin" className="block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center">Manage Users</Link>
            <Link to="/admin/uploads" className="block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-center">User Uploads</Link>
            <Link to="/admin/invites" className="block px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-center">Manage Invites</Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
