import React, { useState } from 'react';
import { ChevronLeft, Lock, ShieldCheck, Smartphone, LogOut, RefreshCw } from 'lucide-react';
import api, { sessionAPI, authAPI } from '../../services/api';

export default function AccountSecurityPage({ onBack }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFA, setTwoFA] = useState(false);
  const [twoFASetup, setTwoFASetup] = useState(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [backupRemaining, setBackupRemaining] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const loadSessions = async () => {
    setSessionLoading(true); setSessionError('');
    try {
      const res = await sessionAPI.list();
      setSessions(res.data.data || []);
    } catch (err) {
      setSessionError(err.response?.data?.message || 'Failed to load sessions');
    } finally { setSessionLoading(false); }
  };

  const load2FA = async () => { try { const r = await authAPI.twoFactorStatus(); setTwoFA(!!r.data.data?.enabled); setBackupRemaining(Number(r.data.data?.backupCodesRemaining || 0)); } catch {} };
  React.useEffect(() => { loadSessions(); load2FA(); }, []);

  const revokeSession = async (id) => {
    if (!window.confirm('Log out this device?')) return;
    try { await sessionAPI.revoke(id); await loadSessions(); }
    catch (err) { setSessionError(err.response?.data?.message || 'Failed to log out device'); }
  };

  const logoutAll = async () => {
    if (!window.confirm('Log out from all devices? You will also be logged out here.')) return;
    try {
      await sessionAPI.logoutAll();
      localStorage.removeItem('token');
      window.location.reload();
    } catch (err) { setSessionError(err.response?.data?.message || 'Failed to log out all devices'); }
  };


  const handleUpdate = async () => {
    setError('');
    setMsg('');
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      setMsg('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const start2FA = async () => { setTwoFALoading(true); setError(''); try { const r=await authAPI.twoFactorSetup(); setTwoFASetup(r.data.data); } catch(e){setError(e.response?.data?.message||'Failed to start 2FA setup');} finally{setTwoFALoading(false);} };
  const enable2FA = async () => { setTwoFALoading(true); try { await authAPI.twoFactorEnable(twoFACode); setMsg('Two-factor authentication enabled. Save your backup codes safely.'); setTwoFASetup(null); setTwoFACode(''); await load2FA(); } catch(e){setError(e.response?.data?.message||'Invalid authenticator code');} finally{setTwoFALoading(false);} };
  const disable2FA = async () => { setTwoFALoading(true); try { await authAPI.twoFactorDisable(disablePassword,twoFACode); setMsg('Two-factor authentication disabled.'); setTwoFA(false); setDisablePassword(''); setTwoFACode(''); await load2FA(); } catch(e){setError(e.response?.data?.message||'Failed to disable 2FA');} finally{setTwoFALoading(false);} };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Account & Security</h1>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-5 h-5 text-pink-500" />
            <h2 className="font-bold">Change Password</h2>
          </div>
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}
          {msg && <div className="bg-green-50 text-green-600 text-sm px-3 py-2 rounded-lg mb-3">{msg}</div>}
          <input
            type="password"
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3"
          />
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3"
          />
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-blue-500 text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-500" />
              <h2 className="font-bold">Where you're logged in</h2>
            </div>
            <button onClick={loadSessions} disabled={sessionLoading} className="p-2 rounded-lg bg-gray-50 text-gray-500 disabled:opacity-50" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${sessionLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-3">Review active devices and log out sessions you don't recognize.</p>
          {sessionError && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{sessionError}</div>}
          {sessions.length === 0 && !sessionLoading ? (
            <p className="text-sm text-gray-400 py-3">No tracked sessions yet. Sign in again to start device tracking.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Smartphone className="w-4 h-4 text-blue-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><p className="font-semibold text-sm truncate">{s.deviceName || 'Web browser'}</p>{s.isCurrent && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">THIS DEVICE</span>}</div>
                    <p className="text-[11px] text-gray-400 truncate">Last active {new Date(s.lastSeenAt).toLocaleString()}</p>
                  </div>
                  {!s.isCurrent && <button onClick={() => revokeSession(s.id)} className="text-xs font-semibold text-red-500 flex items-center gap-1"><LogOut className="w-3.5 h-3.5" />Log out</button>}
                </div>
              ))}
            </div>
          )}
          {sessions.length > 0 && <button onClick={logoutAll} className="w-full mt-3 py-2.5 rounded-xl border border-red-200 text-red-600 font-semibold text-sm">Log out all devices</button>}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-5 h-5 text-purple-500" /><h2 className="font-bold">Two-Factor Authentication</h2></div>
          <p className="text-sm text-gray-500 mb-3">Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP authenticator. Codes are enforced at login.</p>
          {!twoFA ? <>
            <button onClick={start2FA} disabled={twoFALoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-blue-500 text-white font-semibold disabled:opacity-50">{twoFALoading?'Preparing...':'Set up authenticator'}</button>
            {twoFASetup && <div className="mt-4 p-4 rounded-xl bg-gray-50 space-y-3"><p className="text-sm font-semibold">1. Add this secret to your authenticator</p><code className="block break-all text-xs bg-white border rounded-lg p-3">{twoFASetup.secret}</code><p className="text-xs text-gray-500">Or use the otpauth URI below if your authenticator supports it.</p><code className="block break-all text-[10px] bg-white border rounded-lg p-3">{twoFASetup.otpauthUri}</code><p className="text-sm font-semibold">2. Enter the 6-digit code</p><input value={twoFACode} onChange={e=>setTwoFACode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" placeholder="123456" className="w-full border rounded-xl px-4 py-3"/><button onClick={enable2FA} disabled={twoFACode.length!==6||twoFALoading} className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold disabled:opacity-50">Enable 2FA</button><div className="border-t pt-3"><p className="text-sm font-semibold mb-1">Backup codes — save these now</p><div className="grid grid-cols-2 gap-2">{twoFASetup.backupCodes.map(c=><code key={c} className="bg-white border rounded px-2 py-1 text-xs text-center">{c}</code>)}</div></div></div>}
          </> : <>
            <div className="flex items-center justify-between mb-3"><span className="text-sm font-semibold text-emerald-600">✓ Authenticator enabled</span><span className="text-xs text-gray-500">{backupRemaining} backup codes left</span></div>
            <input type="password" value={disablePassword} onChange={e=>setDisablePassword(e.target.value)} placeholder="Current password" className="w-full border rounded-xl px-4 py-3 mb-2"/><input value={twoFACode} onChange={e=>setTwoFACode(e.target.value)} inputMode="numeric" placeholder="Authenticator or backup code" className="w-full border rounded-xl px-4 py-3 mb-2"/><button onClick={disable2FA} disabled={!disablePassword||!twoFACode||twoFALoading} className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-semibold disabled:opacity-50">Disable 2FA</button>
          </>}
        </div>
      </div>
    </div>
  );
}
