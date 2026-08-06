import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Shield, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { adminMutate } from '../../components/admin/adminFetch';
import { EmptyState, ErrorState, TableLoadingState } from '../../components/ui/states';

interface Permission {
  id: string;
  role: string;
  calculatorId: string;
  calculatorName: string;
  createdAt: string;
}

export function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('USER');
  const [selectedCalculator, setSelectedCalculator] = useState('');
  const [calculatorError, setCalculatorError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/admin/permissions');
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      setPermissions(data.permissions || []);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Request failed.';
      setLoadError(description);
      toast.error('Could not load permissions', { description });
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedCalculator) {
      setCalculatorError('Select a calculator to grant access to.');
      return;
    }
    setCalculatorError('');

    const ok = await adminMutate('/api/admin/permissions/grant', {
      body: { role: selectedRole, calculatorId: selectedCalculator },
      success: `Access granted to ${selectedRole}.`,
      error: 'Failed to grant access',
    });
    if (ok) setSelectedCalculator('');
    fetchPermissions();
  };

  const handleRevokeAccess = async (perm: Permission) => {
    await adminMutate(`/api/admin/permissions/${perm.id}`, {
      method: 'DELETE',
      success: `Revoked ${perm.calculatorName} from ${perm.role}.`,
      error: `Failed to revoke ${perm.calculatorName}`,
    });
    fetchPermissions();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield size={32} className="text-blue-600" />
          <h2 className="text-3xl font-bold text-slate-900">Permissions</h2>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Grant Calculator Access</h3>
          
          <div className="flex gap-4 mb-2">
            <select
              aria-label="Role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>

            <select
              aria-label="Calculator"
              aria-invalid={!!calculatorError}
              aria-describedby={calculatorError ? 'calculator-error' : undefined}
              value={selectedCalculator}
              onChange={(e) => {
                setSelectedCalculator(e.target.value);
                setCalculatorError('');
              }}
              className={`px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 flex-1 ${
                calculatorError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:ring-blue-500'
              }`}
            >
              <option value="">Select Calculator...</option>
              <option value="debt-equity">Debt to Equity</option>
              <option value="current-ratio">Current Ratio</option>
              <option value="dscr">DSCR</option>
              <option value="ebitda">EBITDA</option>
              <option value="iscr">ISCR</option>
              <option value="working-capital-cycle">Working Capital Cycle</option>
            </select>

            <button
              onClick={handleGrantAccess}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={20} />
              Grant Access
            </button>
          </div>
          {calculatorError && (
            <p id="calculator-error" role="alert" className="text-sm text-red-600 mb-6">
              {calculatorError}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          {loading ? (
            <TableLoadingState rows={4} columns={4} />
          ) : loadError ? (
            <ErrorState
              title="Could not load permissions"
              description={loadError}
              onRetry={fetchPermissions}
            />
          ) : permissions.length === 0 ? (
            <EmptyState
              title="No permissions granted yet"
              description="Grant a role access to a calculator using the form above."
            />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Calculator</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Granted At</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm) => (
                  <tr key={perm.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {perm.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">{perm.calculatorName}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(perm.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <ConfirmDialog
                        title={`Revoke ${perm.calculatorName}?`}
                        description={`Every user with the ${perm.role} role immediately loses access to ${perm.calculatorName}. You can grant it again from this page.`}
                        confirmLabel="Revoke access"
                        destructive
                        onConfirm={() => handleRevokeAccess(perm)}
                        trigger={
                          <button
                            aria-label={`Revoke ${perm.calculatorName} from ${perm.role}`}
                            className="p-1 hover:bg-red-100 rounded"
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
