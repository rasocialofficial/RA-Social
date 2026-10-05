import React, { useEffect, useState } from 'react';
import { ChevronLeft, BadgeDollarSign, CheckCircle2, Clock3, XCircle, Lock } from 'lucide-react';
import { monetizationAPI } from '../../services/api';

const statusMeta = {
  not_eligible: { label: 'Not Eligible', icon: Lock, className: 'bg-gray-100 text-gray-600' },
  eligible: { label: 'Eligible', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', icon: Clock3, className: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-blue-100 text-blue-700' },
};

export default function MonetizationPage({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await monetizationAPI.status();
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load monetization status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApply = async () => {
    setApplying(true);
    setMessage('');
    setError('');
    try {
      const res = await monetizationAPI.apply();
      setMessage(res.data.message || 'Application submitted successfully');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit application');
    } finally {
      setApplying(false);
    }
  };

  const meta = statusMeta[data?.status] || statusMeta.not_eligible;
  const StatusIcon = meta.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} aria-label="Back"><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Monetization</h1>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-blue-500 flex items-center justify-center">
                  <BadgeDollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Creator Monetization</h2>
                  <p className="text-xs text-gray-500">Ads · Memberships · Tips</p>
                </div>
              </div>

              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${meta.className}`}>
                <StatusIcon className="w-4 h-4" />
                {meta.label}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">Followers</p>
                  <p className="text-xl font-bold">{data.followers}</p>
                  <p className="text-xs text-gray-400">Need {data.requirements.minFollowers}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">Posts</p>
                  <p className="text-xl font-bold">{data.posts}</p>
                  <p className="text-xs text-gray-400">Need {data.requirements.minPosts}</p>
                </div>
              </div>

              {data.status === 'not_eligible' && (
                <p className="text-sm text-gray-500 mt-4">
                  Reach {data.requirements.minFollowers} followers and publish {data.requirements.minPosts} posts to become eligible.
                </p>
              )}

              <button
                onClick={handleApply}
                disabled={!data.eligible || data.status !== 'eligible' || applying}
                className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-blue-500 text-white font-semibold disabled:bg-gray-300 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed"
              >
                {applying ? 'Submitting...' : 'Monetization Apply'}
              </button>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3">Earnings</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Ads</span><span className="font-semibold">Available after approval</span></div>
                <div className="flex justify-between"><span>Memberships</span><span className="font-semibold">Available after approval</span></div>
                <div className="flex justify-between"><span>Tips</span><span className="font-semibold">Available after approval</span></div>
                <div className="flex justify-between border-t pt-3 mt-3"><span>Total Earnings</span><span className="font-bold">${Number(data.earnings || 0).toFixed(2)}</span></div>
              </div>
            </div>

            {data.status === 'approved' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                Monetization is active on your account.
              </div>
            )}

            {message && <p className="text-center text-sm text-green-600">{message}</p>}
            {error && <p className="text-center text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
