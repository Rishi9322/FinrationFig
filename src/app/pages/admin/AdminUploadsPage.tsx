import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { getAdminUploads, downloadAdminUpload, AdminUpload } from '../../../lib/adminAnalytics';

function formatSize(bytes: number | null): string {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminUploadsPage() {
  const [uploads, setUploads] = useState<AdminUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    getAdminUploads()
      .then(setUploads)
      .catch((err) => toast.error(err.message || 'Failed to load uploads'))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload(u: AdminUpload) {
    setBusyId(u.id);
    try {
      await downloadAdminUpload(u);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-slate-900">User Uploads</h1>

        {loading ? (
          <div>Loading...</div>
        ) : uploads.length === 0 ? (
          <p className="text-slate-600">No files uploaded yet.</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Uploaded by</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.filename}</td>
                    <td className="px-4 py-3 text-slate-600">{u.userEmail ?? u.userId}</td>
                    <td className="px-4 py-3 text-slate-600">{formatSize(u.sizeBytes)}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(u.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDownload(u)}
                        disabled={busyId === u.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Download size={16} />
                        {busyId === u.id ? 'Downloading…' : 'Download'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
