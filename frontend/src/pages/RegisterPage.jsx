import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const checkUsernameAvailability = async (value) => {
    const name = value.trim();
    if (!name) {
      setUsernameStatus('idle');
      return;
    }
    if (name.length < 3) {
      setUsernameStatus('too_short');
      return;
    }

    setUsernameChecking(true);
    try {
      const response = await authAPI.checkUsername(name);
      setUsernameStatus(response.data?.data?.available ? 'available' : 'taken');
    } catch {
      // Do not block registration because of a temporary availability-check failure.
      setUsernameStatus('idle');
    } finally {
      setUsernameChecking(false);
    }
  };

  useEffect(() => {
    const name = username.trim();
    if (!name) {
      setUsernameStatus('idle');
      setUsernameChecking(false);
      return undefined;
    }
    if (name.length < 3) {
      setUsernameStatus('too_short');
      setUsernameChecking(false);
      return undefined;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(() => checkUsernameAvailability(name), 450);
    return () => clearTimeout(timer);
  }, [username]);

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (usernameStatus === 'taken') {
        setError('This username is already taken. Please choose a new username.');
        setLoading(false);
        return;
      }
      if (usernameStatus !== 'available') {
        const name = username.trim();
        if (name.length < 3) {
          setError('Username must be at least 3 characters.');
          setLoading(false);
          return;
        }
        setUsernameChecking(true);
        const response = await authAPI.checkUsername(name);
        const available = response.data?.data?.available === true;
        setUsernameStatus(available ? 'available' : 'taken');
        setUsernameChecking(false);
        if (!available) {
          setError('This username is already taken. Please choose a new username.');
          setLoading(false);
          return;
        }
      }

      await register(username.trim(), email, password, fullName, phoneNumber);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 px-4 py-12">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">RA</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 mt-2">Join RA Social today</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Your Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={handleUsernameChange}
                required
                minLength={3}
                autoComplete="username"
                className={`w-full px-4 py-3 pr-11 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${usernameStatus === 'taken' ? 'border-red-400' : usernameStatus === 'available' ? 'border-green-400' : 'border-gray-300'}`}
                placeholder="@username"
              />
              {usernameStatus === 'available' && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" aria-label="Username available" />}
              {usernameStatus === 'taken' && <X className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" aria-label="Username taken" />}
            </div>
            {usernameStatus === 'available' && <p className="text-xs text-green-600 mt-1">Username is available ✓</p>}
            {usernameStatus === 'taken' && <p className="text-xs text-red-600 mt-1">Username already exists. Please choose another.</p>}
            {usernameStatus === 'too_short' && <p className="text-xs text-gray-500 mt-1">Username must be at least 3 characters.</p>}
            {usernameChecking && <p className="text-xs text-gray-500 mt-1">Checking username...</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number <span className="text-gray-400">(optional)</span></label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+() -]/g, ''))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="+91 98765 43210"
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-4 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-purple-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;