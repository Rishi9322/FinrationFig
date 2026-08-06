import React, { useState, useEffect } from 'react';
import { ToggleRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';
import { adminMutate } from './adminFetch';
import { EmptyState, ErrorState, TableLoadingState } from '../ui/states';

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
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchCalculators();
  }, []);

  const fetchCalculators = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/admin/calculators');
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      setCalculators(data.calculators || []);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Request failed.';
      setLoadError(description);
      toast.error('Could not load calculators', { description });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCalculator = async (calculatorId: string, name: string, enabled: boolean) => {
    await adminMutate(`/api/admin/calculators/${calculatorId}/toggle`, {
      body: { enabled: !enabled },
      success: `${name} ${enabled ? 'disabled' : 'enabled'}.`,
      error: `Failed to ${enabled ? 'disable' : 'enable'} ${name}`,
    });
    fetchCalculators();
  };

  const handleTogglePublic = async (calculatorId: string, name: string, isPublic: boolean) => {
    await adminMutate(`/api/admin/calculators/${calculatorId}/visibility`, {
      body: { isPublic: !isPublic },
      success: `${name} is now ${isPublic ? 'private' : 'public'}.`,
      error: `Failed to change visibility for ${name}`,
    });
    fetchCalculators();
  };

  const handleUnlockAll = async () => {
    await adminMutate('/api/admin/calculators/unlock-all', {
      success: 'All calculators unlocked.',
      error: 'Failed to unlock calculators',
    });
    fetchCalculators();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-900">Calculators Management</h2>
        <ConfirmDialog
          title="Unlock all calculators?"
          description="Every calculator is enabled and made public, including any currently restricted to specific roles. Individual visibility settings are overwritten."
          confirmLabel="Unlock all"
          onConfirm={handleUnlockAll}
          trigger={
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Unlock All
            </button>
          }
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <TableLoadingState rows={6} columns={6} />
        ) : loadError ? (
          <ErrorState
            title="Could not load calculators"
            description={loadError}
            onRetry={fetchCalculators}
          />
        ) : calculators.length === 0 ? (
          <EmptyState
            title="No calculators configured"
            description="Calculators appear here once they are registered in the backend."
          />
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
                      onClick={() => handleToggleCalculator(calc.id, calc.name, calc.enabled)}
                      aria-label={`${calc.enabled ? 'Disable' : 'Enable'} ${calc.name}`}
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
                      onClick={() => handleTogglePublic(calc.id, calc.name, calc.isPublic)}
                      aria-label={`Make ${calc.name} ${calc.isPublic ? 'private' : 'public'}`}
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
