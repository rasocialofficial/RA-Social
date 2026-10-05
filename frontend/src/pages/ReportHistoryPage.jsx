import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Flag, Clock3, CheckCircle2, XCircle, Eye, FileText, Image as ImageIcon } from 'lucide-react';
import { reportAPI } from '../services/api';

const statusMeta = {
  pending: { label: 'Pending review', icon: Clock3, cls: 'bg-amber-50 text-amber-700' },
  reviewed: { label: 'Reviewed', icon: Eye, cls: 'bg-blue-50 text-blue-700' },
  resolved: { label: 'Resolved', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700' },
  dismissed: { label: 'Dismissed', icon: XCircle, cls: 'bg-gray-100 text-gray-600' }
};

export default function ReportHistoryPage({ onBack, searchQuery = '' }) {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await reportAPI.mine();
      setReports(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load report history');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => filter === 'all' ? reports : reports.filter(r => r.status === filter), [reports, filter]);
  const searched = useMemo(() => { const q = String(searchQuery || '').trim().toLowerCase(); if (!q) return visible; return visible.filter(r => [r.reason, r.status, r.post?.content, r.post?.user?.username].filter(Boolean).join(' ').toLowerCase().includes(q)); }, [visible, searchQuery]);
  const counts = useMemo(() => ({
    all: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    dismissed: reports.filter(r => r.status === 'dismissed').length
  }), [reports]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ChevronLeft className="w-6 h-6" /></button>
        <div className="flex-1"><h1 className="font-bold text-gray-900">Report History</h1><p className="text-xs text-gray-500">Track posts you have reported</p></div>
        <button onClick={load} disabled={loading} className="text-xs font-semibold text-purple-600 disabled:opacity-50">Refresh</button>
      </header>

      <div className="p-4">
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[['all','All'],['pending','Pending'],['resolved','Resolved'],['dismissed','Dismissed']].map(([key,label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`rounded-xl py-2 px-1 text-xs font-semibold ${filter === key ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {label}<span className="block text-[10px] opacity-80 mt-0.5">{counts[key]}</span>
            </button>
          ))}
        </div>

        {loading ? <div className="bg-white rounded-2xl p-8 text-center text-sm text-gray-500">Loading report history…</div> :
         error ? <div className="bg-white rounded-2xl p-6 text-center"><p className="text-sm text-red-600 mb-3">{error}</p><button onClick={load} className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold">Try again</button></div> :
         searched.length === 0 ? <div className="bg-white rounded-2xl p-8 text-center shadow-sm"><Flag className="w-10 h-10 mx-auto text-gray-300 mb-3"/><p className="font-semibold text-gray-700">No reports found</p><p className="text-xs text-gray-500 mt-1">Posts you report will appear here.</p></div> :
         <div className="space-y-3">{searched.map(report => <ReportItem key={report.id} report={report} />)}</div>}
      </div>
    </div>
  );
}

function ReportItem({ report }) {
  const meta = statusMeta[report.status] || statusMeta.pending;
  const Icon = meta.icon;
  const post = report.post;
  const date = new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0"><Flag className="w-5 h-5 text-red-500" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold ${meta.cls}`}><Icon className="w-3.5 h-3.5" />{meta.label}</span>
            <span className="text-[10px] text-gray-400 shrink-0">{date}</span>
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-3">Reason: <span className="font-normal">{report.reason}</span></p>
          {post ? <div className="mt-3 rounded-xl border border-gray-100 overflow-hidden bg-gray-50">
            {post.mediaUrl && post.mediaType?.startsWith('image') && <img src={post.mediaUrl} alt="Reported post" className="w-full max-h-52 object-cover" />}
            {post.mediaUrl && post.mediaType?.startsWith('video') && <div className="h-36 flex items-center justify-center bg-black text-white"><ImageIcon className="w-7 h-7 opacity-60" /></div>}
            <div className="p-3"><div className="flex items-center gap-2 mb-1"><FileText className="w-3.5 h-3.5 text-gray-400"/><span className="text-xs font-semibold text-gray-700">@{post.user?.username || 'user'}</span></div><p className="text-xs text-gray-600 line-clamp-3">{post.content || 'Media post'}</p></div>
          </div> : <p className="text-xs text-gray-500 mt-3">The reported post is no longer available.</p>}
        </div>
      </div>
    </div>
  );
}
