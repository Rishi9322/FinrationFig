import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import {
  getAdminNews, setNewsStatus, setNewsSourceEnabled, refreshNewsNow,
  NewsItem, NewsSource,
} from '../../../lib/news';

const TABS: NewsItem['status'][] = ['pending', 'approved', 'rejected'];

export function AdminNewsPage() {
  const [tab, setTab] = useState<NewsItem['status']>('pending');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getAdminNews(tab);
      setItems(data.items);
      setSources(data.sources);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); await load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Action failed'); }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await refreshNewsNow();
      toast.success(`Fetched ${r.sources} source(s), ${r.added} new item(s)`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900">News feed</h1>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>

        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-slate-900 mb-3">Sources</h2>
          <ul className="divide-y divide-slate-100">
            {sources.map((s) => (
              <li key={s.id} className="py-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`Enable ${s.name}`}
                  checked={s.enabled}
                  onChange={(e) => act(() => setNewsSourceEnabled(s.id, e.target.checked))}
                  className="mt-1 h-4 w-4"
                />
                <div className="text-sm">
                  <div className="font-medium text-slate-900">{s.name}</div>
                  {s.note && <div className="text-slate-500">{s.note}</div>}
                  <div className="text-xs text-slate-400">
                    {s.lastFetchedAt ? `Last fetched ${new Date(s.lastFetchedAt).toLocaleString()}` : 'Never fetched'}
                    {s.lastStatus ? ` · ${s.lastStatus}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`px-3 py-1.5 rounded-lg capitalize ${tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 shadow'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : items.length === 0 ? (
          <p className="text-slate-600">Nothing {tab} right now.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.id} className="bg-white rounded-lg shadow p-4">
                <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-blue-700 hover:underline">
                  {it.title}
                </a>
                {it.snippet && <p className="text-sm text-slate-600 mt-1">{it.snippet}</p>}
                <p className="text-xs text-slate-500 mt-1">
                  {it.sourceName}{it.author ? ` · ${it.author}` : ''}
                  {it.publishedAt ? ` · ${new Date(it.publishedAt).toLocaleDateString()}` : ''}
                </p>
                <div className="flex gap-2 mt-3">
                  {it.status !== 'approved' && (
                    <button onClick={() => act(() => setNewsStatus(it.id, 'approved'))} className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-700">Approve</button>
                  )}
                  {it.status !== 'rejected' && (
                    <button onClick={() => act(() => setNewsStatus(it.id, 'rejected'))} className="px-3 py-1 rounded bg-slate-200 text-slate-800 text-sm hover:bg-slate-300">Reject</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}
