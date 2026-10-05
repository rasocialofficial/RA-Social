import React, { useState } from 'react';
import { ArrowLeft, Download, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { accountAPI } from '../../services/api';

export default function AccountDataPage({ onBack, onDeleted }) {
  const [exporting, setExporting] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const exportData = async () => {
    setExporting(true); setMessage('');
    try {
      const res = await accountAPI.exportData();
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `ra-social-account-data-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setMessage('Your account data export is ready.');
    } catch (e) { setMessage(e.response?.data?.message || 'Export failed.'); }
    finally { setExporting(false); }
  };

  const removeAccount = async () => {
    if (!password) return setMessage('Enter your password first.');
    if (!window.confirm('Delete your RA Social account permanently? This cannot be undone.')) return;
    setDeleting(true); setMessage('');
    try {
      await accountAPI.delete(password);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      onDeleted?.();
    } catch (e) { setMessage(e.response?.data?.message || 'Account deletion failed.'); }
    finally { setDeleting(false); }
  };

  return <div className="min-h-screen bg-gray-50 pb-24">
    <div className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
      <button onClick={onBack} className="p-1"><ArrowLeft /></button><h1 className="font-bold text-lg">Account Data</h1>
    </div>
    <div className="p-4 space-y-4">
      <section className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><ShieldCheck className="text-white" /></div><div><h2 className="font-bold">Export your data</h2><p className="text-sm text-gray-500 mt-1">Download your profile, posts, comments, likes, follows, reports, saved posts, earnings, payouts and AI data as JSON.</p></div></div>
        <button onClick={exportData} disabled={exporting} className="mt-4 w-full rounded-xl bg-blue-600 text-white py-3 font-semibold disabled:bg-gray-300">{exporting ? 'Preparing export…' : <><Download className="inline w-4 h-4 mr-2" />Download my data</>}</button>
      </section>
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-red-100">
        <div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center"><AlertTriangle className="text-white" /></div><div><h2 className="font-bold text-red-600">Delete account</h2><p className="text-sm text-gray-500 mt-1">This permanently removes your account and associated app data. This action cannot be undone.</p></div></div>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" className="w-full border rounded-xl px-3 py-3 mt-4" />
        <button onClick={removeAccount} disabled={deleting} className="mt-3 w-full rounded-xl bg-red-600 text-white py-3 font-semibold disabled:bg-gray-300"><Trash2 className="inline w-4 h-4 mr-2" />{deleting ? 'Deleting…' : 'Permanently delete account'}</button>
      </section>
      {message && <p className="text-sm text-gray-600 bg-white rounded-xl p-3">{message}</p>}
    </div>
  </div>;
}
