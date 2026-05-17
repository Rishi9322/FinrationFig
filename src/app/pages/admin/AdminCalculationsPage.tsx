import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Search, Download } from 'lucide-react';

interface Calculation {
  id: string;
  userId: string;
  calculatorType: string;
  createdAt: string;
  status: string;
  name?: string;
}

export function AdminCalculationsPage() {
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCalculations();
  }, []);

  const fetchCalculations = async () => {
    try {
      const response = await fetch('/api/admin/calculations');
      const data = await response.json();
      setCalculations(data.calculations || []);
    } catch (error) {
      console.error('Failed to fetch calculations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalculations = calculations.filter((calc) =>
    calc.calculatorType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    calc.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-slate-900">Calculations</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Download size={20} />
            Export
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search calculations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Calculator Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">User ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalculations.map((calc) => (
                    <tr key={calc.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">{calc.id.slice(0, 8)}...</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{calc.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{calc.calculatorType}</td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">{calc.userId.slice(0, 8)}...</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          {calc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(calc.createdAt).toLocaleDateString()}
                      </td>
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
