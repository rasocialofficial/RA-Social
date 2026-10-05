import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import api from '../services/api';

export default function OtpVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const identifier = location.state?.identifier || '';
  const challengeId = location.state?.challengeId || '';
  const devOtp = location.state?.devOtp || '';
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef([]);

  if (!identifier) {
    navigate('/forgot-password');
    return null;
  }

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const otp = digits.join('');
    if (otp.length !== 6) {
      setError('Enter all 6 digits');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { identifier, otp, challengeId });
      navigate('/reset-password', { state: { resetToken: res.data.data.resetToken } });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-200 via-pink-200 to-purple-300 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/forgot-password')} className="p-2 rounded-full bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-lg">RA Social</span>
        </div>

        <h1 className="text-2xl font-bold mb-1">Enter OTP</h1>
        <p className="text-gray-500 text-sm mb-6">We sent a 6-digit one-time code</p>

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="flex justify-between gap-2 mb-6">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputsRef.current[i] = el)}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                maxLength={1}
                className="w-11 h-14 text-center text-xl font-bold border-2 border-purple-200 rounded-xl focus:outline-none focus:border-purple-500"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
      </div>
    </div>
  );
}
