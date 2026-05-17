import React, { useState, useEffect } from 'react';
import { Toggle, ToggleRight, Eye, EyeOff } from 'lucide-react';

interface Calculator {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  enabled: boolean;
  isPublic: boolean;
  version: string;
}

export function CalculatorsManagement() {
  const [calculators, setCalculators] = useState<Calculator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalculators();
  }, []);

  const fetchCalculators = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/calculators');
      const data = await response.json();
      setCalculators(data.calculators || []);
    } catch (error) {
      console.error('Failed to fetch calculators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCalculator = async (calculatorId: string, enabled: boolean) => {
    try {
      await fetch(`/api/admin/calculators/${calculatorId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      fetchCalculators();
    } catch (error) {
      console.error('Failed to toggle calculator:', error);
    }
  };

  const handleTogglePublic = async (calculatorId: string, isPublic: boolean) => {
    try {
      await fetch(`/api/admin/calculators/${calculatorId}/visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      fetchCalculators();
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
    }
  };

  const handleUnlockAll = async () => {
    if (confirm('Are you sure you want to unlock all calculators?')) {
      try {
        await fetch('/api/admin/calculators/unlock-all', { method: 'POST' });
        fetchCalculators();
      } catch (error) {
        console.error('Failed to unlock calculators:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-900">Calculators Management</h2>
        <button
          onClick={handleUnlockAll}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Unlock All
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="p-6 text-center">Loading calculators...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Slug</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Category</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Version</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">Enabled</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">Public</th>
              </tr>
            </thead>
            <tbody>
              {calculators.map((calc) => (
                <tr key={calc.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{calc.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{calc.slug}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                      {calc.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{calc.version}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleToggleCalculator(calc.id, calc.enabled)}
                      className={`p-2 rounded-lg transition ${
                        calc.enabled
                          ? 'bg-green-100 text-green-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      <ToggleRight size={20} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleTogglePublic(calc.id, calc.isPublic)}
                      className={`p-2 rounded-lg transition ${
                        calc.isPublic
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {calc.isPublic ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
