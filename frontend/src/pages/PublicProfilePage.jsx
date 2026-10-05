import React, { useEffect, useState } from 'react';
import { ArrowLeft, UserPlus, UserCheck } from 'lucide-react';
import { followAPI, userAPI } from '../services/api';

export default function PublicProfilePage({ userId, onBack }) {
  const [profile, setProfile] = useState(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const load = async () => {
    try {
      const [profileRes, statusRes] = await Promise.all([userAPI.getPublic(userId), followAPI.getStatus(userId)]);
      setProfile(profileRes.data.data); setFollowing(Boolean(statusRes.data?.data?.following));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [userId]);

  const toggleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try { const r = await followAPI.follow(userId); setFollowing(Boolean(r.data?.data?.following)); await load(); }
    catch (e) { alert(e.response?.data?.message || 'Unable to update follow'); }
    finally { setFollowLoading(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading profile...</div>;
  if (!profile) return <div className="p-6"><button onClick={onBack}><ArrowLeft /></button><p className="mt-6">Profile not found.</p></div>;

  return <div className="min-h-screen bg-gray-50 pb-24">
    <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-20"><button onClick={onBack}><ArrowLeft /></button><b>@{profile.username}</b></div>
    <div className="bg-white p-6 text-center">
      <img src={profile.avatarUrl || `https://i.pravatar.cc/150?u=${profile.id}`} className="w-24 h-24 rounded-full object-cover mx-auto" alt="" />
      <h1 className="text-xl font-bold mt-3">{profile.fullName || profile.username}</h1><p className="text-gray-500">@{profile.username}</p>
      {profile.bio && <p className="mt-2 text-gray-700 max-w-md mx-auto">{profile.bio}</p>}
      <div className="flex justify-center gap-8 mt-5"><span><b>{profile.postsCount}</b><small className="block text-gray-500">Posts</small></span><span><b>{profile.followersCount}</b><small className="block text-gray-500">Followers</small></span><span><b>{profile.followingCount}</b><small className="block text-gray-500">Following</small></span></div>
      <button onClick={toggleFollow} disabled={followLoading} className="mt-5 px-6 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold flex items-center gap-2 mx-auto disabled:opacity-50">{following ? <UserCheck className="w-4 h-4"/> : <UserPlus className="w-4 h-4"/>}{following ? 'Following' : 'Follow'}</button>
    </div>
    <div className="grid grid-cols-3 gap-1 mt-2">{(profile.posts || []).map(p => <div key={p.id} className="aspect-square bg-white overflow-hidden">{p.mediaUrl ? (p.mediaType?.startsWith('video') ? <video src={p.mediaUrl} className="w-full h-full object-cover" muted /> : <img src={p.mediaUrl} className="w-full h-full object-cover" alt="" />) : <div className="p-3 text-sm line-clamp-6">{p.content}</div>}</div>)}</div>
  </div>;
}
