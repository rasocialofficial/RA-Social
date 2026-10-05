import React, { useEffect, useState } from 'react';
import { ChevronLeft, DollarSign, TrendingUp, Wallet, Clock3, RefreshCw } from 'lucide-react';
import { monetizationAPI } from '../../services/api';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const label = (source) => String(source || 'other').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdRevenuePage({ onBack }) {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { const res = await monetizationAPI.analytics(days); setData(res.data.data); }
    catch (err) { setError(err.response?.data?.message || 'Failed to load earnings analytics'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [days]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} aria-label="Back"><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Earnings Analytics</h1>
        <button onClick={load} className="ml-auto" aria-label="Refresh"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      <div className="p-4 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>}
        {loading && !data ? <div className="bg-white rounded-2xl p-8 text-center text-gray-500">Loading analytics...</div> : data && <>
          <div className="flex bg-white rounded-full p-1 shadow-sm">
            {[30, 90, 365].map((value) => <button key={value} onClick={() => setDays(value)} className={`flex-1 py-2 rounded-full text-sm font-semibold ${days === value ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white' : 'text-gray-500'}`}>{value === 365 ? '1 year' : `${value} days`}</button>)}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Total earnings', data.lifetimeEarnings, DollarSign],
              ['Period earnings', data.periodEarnings, TrendingUp],
              ['Available balance', data.availableBalance, Wallet],
              ['Pending payouts', data.pendingPayouts, Clock3],
            ].map(([title, value, Icon]) => <div key={title} className="bg-white rounded-2xl p-4 shadow-sm"><Icon className="w-5 h-5 text-purple-500 mb-2" /><p className="text-xs text-gray-500">{title}</p><p className="text-xl font-bold text-gray-800">{money(value)}</p></div>)}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold mb-4">Revenue by source</h2>
            {data.sourceBreakdown.length ? data.sourceBreakdown.map((item) => <div key={item.source} className="flex justify-between py-2 border-b last:border-0 text-sm"><span>{label(item.source)}</span><strong>{money(item.amount)}</strong></div>) : <p className="text-sm text-gray-400">No tracked earnings in this period.</p>}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold mb-4">Monthly earnings</h2>
            {data.monthly.length ? data.monthly.map((item) => <div key={item.month} className="flex items-center gap-3 py-2"><span className="w-20 text-xs text-gray-500">{item.month}</span><div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-pink-500 to-blue-500 rounded-full" style={{ width: `${Math.min(100, (item.amount / Math.max(...data.monthly.map((m) => m.amount), 1)) * 100)}%` }} /></div><span className="text-sm font-semibold">{money(item.amount)}</span></div>) : <p className="text-sm text-gray-400">No monthly ledger data yet.</p>}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold mb-4">Recent earnings</h2>
            {data.recentEarnings.length ? data.recentEarnings.map((item) => <div key={item.id} className="py-3 border-b last:border-0"><div className="flex justify-between text-sm"><span className="font-semibold">{label(item.source)}</span><strong className="text-green-600">+{money(item.amount)}</strong></div><p className="text-xs text-gray-500 mt-1">{item.description || 'Creator revenue'} · {new Date(item.createdAt).toLocaleDateString()}</p></div>) : <p className="text-sm text-gray-400">No tracked earnings yet.</p>}
          </div>

          <p className="text-xs text-gray-500 text-center">Tracked earnings come from the creator revenue ledger. Your existing balance is shown separately so older/manual earnings are not silently lost.</p>
        </>}
      </div>
    </div>
  );
}
