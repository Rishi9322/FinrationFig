import React, { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Settings, Save, RefreshCw, AlertCircle } from 'lucide-react';

export function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUnlockAllFeatures = async () => {
    if (!confirm('Are you sure you want to unlock all features for all users?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/settings/unlock-all-features', {
        method: 'POST'
      });
      
      if (response.ok) {
        setMessage('✓ All features unlocked successfully!');
      } else {
        setMessage('✗ Failed to unlock features');
      }
    } catch (error) {
      setMessage('✗ Error unlocking features');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetCalculatorData = async () => {
    if (!confirm('Are you sure? This will archive all calculation history.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/settings/reset-calculations', {
        method: 'POST'
      });
      
      if (response.ok) {
        setMessage('✓ Calculation data reset successfully!');
      } else {
        setMessage('✗ Failed to reset data');
      }
    } catch (error) {
      setMessage('✗ Error resetting data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings size={32} className="text-purple-600" />
          <h2 className="text-3xl font-bold text-slate-900">Admin Settings</h2>
        </div>

        {message && (
          <div className={`p-4 rounded-lg ${message.includes('✓') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {/* Feature Management */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Feature Management</h3>
                <p className="text-slate-600 mt-1">Unlock all calculator features for all users</p>
              </div>
              <button
                onClick={handleUnlockAllFeatures}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw size={20} />
                Unlock All Features
              </button>
            </div>
          </div>

          {/* Data Management */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Data Management</h3>
                <p className="text-slate-600 mt-1">Archive and reset calculation data</p>
              </div>
              <button
                onClick={handleResetCalculatorData}
                disabled={loading}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw size={20} />
                Reset Data
              </button>
            </div>
          </div>

          {/* System Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">System Information</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-200">
                <span className="text-slate-600">Application Version</span>
                <span className="text-slate-900 font-medium">1.0.0</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-200">
                <span className="text-slate-600">Database</span>
                <span className="text-slate-900 font-medium">PostgreSQL</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-200">
                <span className="text-slate-600">API Endpoint</span>
                <span className="text-slate-900 font-medium">v1</span>
              </div>
            </div>
          </div>

          {/* Warning Section */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <h4 className="font-semibold text-yellow-800">Dangerous Operations</h4>
                <p className="text-yellow-700 text-sm mt-1">
                  Some settings above can permanently affect user data and calculator configurations. Please use with caution and ensure proper backups are in place.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
