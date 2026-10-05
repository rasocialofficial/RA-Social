import React, { useEffect, useState } from 'react';
import { ChevronLeft, Wallet, Landmark, RefreshCw } from 'lucide-react';
import { payoutAPI } from '../../services/api';

export default function BillingEarningsPage({ user, onBack }) {
  const earnings = Number(user?.earnings || 0);
  const [payouts, setPayouts] = useState([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [accountLabel, setAccountLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => { try { const r = await payoutAPI.list(); setPayouts(r.data?.data || []); } catch {} finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const pending = payouts.filter(p => p.status === 'pending').reduce((s,p) => s + Number(p.amount || 0), 0);
  const available = Math.max(0, earnings - pending);

  const submit = async (e) => {
    e.preventDefault(); setMessage('');
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 10) return setMessage('Minimum payout is $10.');
    if (n > available) return setMessage(`Available balance: $${available.toFixed(2)}`);
    if (!accountLabel.trim()) return setMessage('Enter a payout account label (for example, UPI ID or bank name).');
    try { setSubmitting(true); await payoutAPI.request({ amount:n, method, accountLabel:accountLabel.trim() }); setAmount(''); setAccountLabel(''); setMessage('Payout request submitted.'); await load(); }
    catch (e) { setMessage(e.response?.data?.message || 'Unable to submit payout request.'); }
    finally { setSubmitting(false); }
  };

  return <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
    <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3"><button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button><h1 className="text-lg font-bold">Billing, Ads & Earnings</h1></div>
    <div className="p-4">
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4 text-center"><p className="text-sm text-gray-500">Total Balance</p><p className="text-3xl font-bold text-gray-800 mb-3">${earnings.toFixed(2)}</p><span className="inline-block px-4 py-1 rounded-full bg-pink-100 text-pink-600 text-sm font-semibold">{available > 0 ? `$${available.toFixed(2)} available` : 'No balance available'}</span></div>
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4"><p className="text-sm text-gray-500 mb-2">Payout Details</p><div className="flex items-center gap-3 py-2"><Wallet className="w-6 h-6 text-pink-500" /><div><p className="text-xs text-gray-400">Available for payout</p><p className="font-bold text-gray-800">${available.toFixed(2)}</p></div></div><div className="flex items-center gap-3 py-2 border-t border-gray-100 mt-2 pt-3"><Landmark className="w-6 h-6 text-purple-500" /><div><p className="text-xs text-gray-400">Payout method</p><p className="font-bold text-gray-800">UPI / Bank / PayPal</p></div></div></div>
      <form onSubmit={submit} className="bg-white rounded-2xl p-5 shadow-sm mb-4"><h2 className="font-bold text-gray-800 mb-3">Request payout</h2><input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="10" step="0.01" placeholder="Amount" className="w-full border rounded-xl px-3 py-3 mb-3" /><select value={method} onChange={e=>setMethod(e.target.value)} className="w-full border rounded-xl px-3 py-3 mb-3"><option value="upi">UPI</option><option value="bank">Bank</option><option value="paypal">PayPal</option></select><input value={accountLabel} onChange={e=>setAccountLabel(e.target.value)} placeholder="Account label / UPI ID / bank name" className="w-full border rounded-xl px-3 py-3 mb-3" /><button disabled={submitting || available < 10} className="w-full py-3 rounded-xl bg-pink-500 text-white font-semibold disabled:bg-gray-300">{submitting ? 'Submitting…' : 'Request payout'}</button>{message && <p className="text-sm text-gray-600 mt-3">{message}</p>}</form>
      <div className="bg-white rounded-2xl p-5 shadow-sm"><div className="flex justify-between items-center mb-3"><h2 className="font-bold text-gray-800">Payout history</h2><button onClick={load}><RefreshCw className="w-4 h-4" /></button></div>{loading ? <p className="text-sm text-gray-500">Loading…</p> : payouts.length === 0 ? <p className="text-sm text-gray-500">No payout requests yet.</p> : payouts.map(p => <div key={p.id} className="flex justify-between items-center border-t py-3"><div><p className="font-semibold">${Number(p.amount).toFixed(2)}</p><p className="text-xs text-gray-500">{p.method.toUpperCase()} · {new Date(p.createdAt).toLocaleString()}</p></div><span className="text-xs font-bold capitalize">{p.status}</span></div>)}</div>
      <p className="text-xs text-gray-500 mt-4">Payout requests are tracked by the platform. Actual bank/UPI/PayPal transfer requires an external payment provider and is not automated by this release.</p>
    </div>
  </div>;
}
