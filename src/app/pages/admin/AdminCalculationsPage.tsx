import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Search, Download } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { getAdminCalculations, calculationsToCsv, AdminCalculation } from '../../../lib/adminAnalytics';

export function AdminCalculationsPage() {
  const [calculations, setCalculations] = useState<AdminCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getAdminCalculations()
      .then(setCalculations)
      .catch((err) => toast.error(err.message || 'Failed to load calculations'))
      .finally(() => setLoading(false));
  }, []);

  const term = searchTerm.toLowerCase();
  const filtered = calculations.filter((c) =>
    c.calculatorType.toLowerCase().includes(term) ||
    (c.userEmail ?? '').toLowerCase().includes(term) ||
    c.id.toLowerCase().includes(term),
  );

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([calculationsToCsv(filtered)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calculations.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-slate-900">Calculations</h2>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={20} />
            Export CSV
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input
              type="text"
              aria-label="Search calculations"
              placeholder="Search by calculator, user email or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div>Loading...</div>
          ) : filtered.length === 0 ? (
            <p className="text-slate-600">No calculations found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Calculator</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">User</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((calc) => (
                    <tr key={calc.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">{calc.id.slice(0, 8)}...</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{calc.calculatorType}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{calc.userEmail ?? calc.userId}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{new Date(calc.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
