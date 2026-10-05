import React, { useState, useRef } from 'react';
import { ChevronLeft, Edit3, Camera } from 'lucide-react';
import api from '../../services/api';
import { uploadAPI } from '../../services/api';

export default function ProfileOverviewPage({ user, onBack, onUpdated }) {
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const fileInputRef = useRef(null);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setUploadingPhoto(true);
    try {
      const res = await uploadAPI.media(file);
      setAvatarUrl(res.data.data.url);
    } catch (error) {
      setErr(error.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      await api.put('/auth/profile', { fullName, bio, avatarUrl, phoneNumber });
      setMsg('Saved successfully!');
      onUpdated?.();
    } catch {
      setErr('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Profile Overview</h1>
      </div>

      <div className="p-4">
        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-pink-400 to-blue-400 flex items-center justify-center border-4 border-white shadow-md">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white">{(fullName?.[0] || user?.username?.[0] || 'U').toUpperCase()}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-br from-pink-500 to-blue-500 rounded-full flex items-center justify-center border-2 border-white"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          </div>
          {uploadingPhoto && <p className="text-xs text-gray-500 mt-2">Uploading photo...</p>}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-bold text-lg">Edit Creator Info</h2>
          </div>

          <label className="text-sm text-gray-500 block mb-1">Display Name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border-2 border-pink-200 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-pink-400"
          />

          <label className="text-sm text-gray-500 block mb-1">Mobile Number</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+() -]/g, ''))}
            placeholder="+91 98765 43210"
            className="w-full border-2 border-pink-200 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-pink-400"
          />

          <label className="text-sm text-gray-500 block mb-1">Bio Description</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full border-2 border-pink-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pink-400"
          />
        </div>

        {msg && <p className="text-center text-sm mt-4 text-green-600">{msg}</p>}
        {err && <p className="text-center text-sm mt-4 text-red-600">{err}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-blue-500 text-white font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
