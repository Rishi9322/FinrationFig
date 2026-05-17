import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Shield, Plus, Trash2 } from 'lucide-react';

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

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/admin/permissions');
      const data = await response.json();
      setPermissions(data.permissions || []);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedCalculator) {
      alert('Please select a calculator');
      return;
    }

    try {
      await fetch('/api/admin/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          calculatorId: selectedCalculator
        })
      });
      fetchPermissions();
      setSelectedCalculator('');
    } catch (error) {
      console.error('Failed to grant access:', error);
    }
  };

  const handleRevokeAccess = async (permissionId: string) => {
    try {
      await fetch(`/api/admin/permissions/${permissionId}`, {
        method: 'DELETE'
      });
      fetchPermissions();
    } catch (error) {
      console.error('Failed to revoke access:', error);
    }
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
          
          <div className="flex gap-4 mb-6">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>

            <select
              value={selectedCalculator}
              onChange={(e) => setSelectedCalculator(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
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
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          {loading ? (
            <div className="p-6 text-center">Loading permissions...</div>
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
                      <button
                        onClick={() => handleRevokeAccess(perm.id)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 size={16} className="text-red-600" />
                      </button>
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
