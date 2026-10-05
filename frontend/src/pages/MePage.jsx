import React, { useState, useEffect, useRef } from 'react';
import {
  User, Calendar, Briefcase, Wallet, Folder, Shield, Eye, Bell, Bookmark, Flag,
  Palette, HelpCircle, LogOut, ChevronRight, ChevronLeft, Film, Users2, DollarSign, PlusCircle, LockKeyhole, BarChart3, Clapperboard, FileText, Clock3, Megaphone, Camera
} from 'lucide-react';
import api, { postAPI, uploadAPI } from '../services/api';

import ProfileOverviewPage from './settings/ProfileOverviewPage';
import AnalyticsHubPage from './settings/AnalyticsHubPage';
import TotalViewsPage from './settings/TotalViewsPage';
import FollowersAnalyticsPage from './settings/FollowersAnalyticsPage';
import AdRevenuePage from './settings/AdRevenuePage';
import PostSchedulerPage from './settings/PostSchedulerPage';
import BrandCollabPage from './settings/BrandCollabPage';
import BillingEarningsPage from './settings/BillingEarningsPage';
import MonetizationPage from './settings/MonetizationPage';
import ContentArchivePage from './settings/ContentArchivePage';
import AccountSecurityPage from './settings/AccountSecurityPage';
import PrivacyVisibilityPage from './settings/PrivacyVisibilityPage';
import NotificationsSettingsPage from './settings/NotificationsSettingsPage';
import InterfaceAccessibilityPage from './settings/InterfaceAccessibilityPage';
import HelpSupportPage from './settings/HelpSupportPage';
import SavedPostsPage from './SavedPostsPage';
import AccountDataPage from './settings/AccountDataPage';
import WatchHistoryPage from './WatchHistoryPage';
import CreatorDashboardPage from './CreatorDashboardPage';
import CreatorAdsPage from './CreatorAdsPage';

const creatorMenuItems = [
  { key: 'analytics', label: 'Creator Analytics', icon: BarChart3, color: 'from-blue-500 to-cyan-400' },
  { key: 'scheduler', label: 'Post Scheduler & Queue', icon: Calendar, color: 'from-purple-500 to-blue-500' },
  { key: 'brandCollab', label: 'Brand Collaborations', icon: Briefcase, color: 'from-pink-500 to-orange-400' },
  { key: 'billing', label: 'Billing, Ads & Earnings', icon: Wallet, color: 'from-blue-500 to-cyan-400' },
  { key: 'monetization', label: 'Monetization', icon: DollarSign, color: 'from-emerald-500 to-teal-400' },
  { key: 'archive', label: 'Content Archive', icon: Folder, color: 'from-indigo-500 to-blue-400' },
];

const accountMenuItems = [
  { key: 'profileOverview', label: 'Profile Overview', icon: User, color: 'from-pink-500 to-purple-500' },
  { key: 'security', label: 'Account & Security', icon: Shield, color: 'from-purple-500 to-pink-500' },
  { key: 'privacy', label: 'Privacy & Visibility', icon: Eye, color: 'from-pink-500 to-purple-400' },
  { key: 'notifications', label: 'Notifications', icon: Bell, color: 'from-orange-400 to-pink-500' },
  { key: 'interface', label: 'Interface & Accessibility', icon: Palette, color: 'from-blue-400 to-purple-500' },
  { key: 'help', label: 'Help & Support', icon: HelpCircle, color: 'from-purple-400 to-pink-400' },
  { key: 'accountData', label: 'Account Data', icon: Shield, color: 'from-red-500 to-orange-500' },
];

export default function MePage({ onLogout, onBack, onOpenDrafts, onOpenReportHistory }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('main');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelError, setChannelError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);
  const meHistoryReadyRef = useRef(false);
  const suppressMeHistoryRef = useRef(false);

  useEffect(() => {
    loadUser();
    const initialView = window.history.state?.raMeView || 'main';
    setView(initialView);
    window.history.replaceState({ ...(window.history.state || {}), raTab: 'me', raMeView: initialView }, '', window.location.href);
    meHistoryReadyRef.current = true;
    const onPopState = (event) => {
      const nextView = event.state?.raMeView || 'main';
      suppressMeHistoryRef.current = true;
      setView(nextView);
      window.setTimeout(() => { suppressMeHistoryRef.current = false; }, 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const loadUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.data);
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  };

  const goView = (nextView) => {
    const viewName = nextView || 'main';
    setView(viewName);
    if (meHistoryReadyRef.current && !suppressMeHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), raTab: 'me', raMeView: viewName }, '', window.location.href);
    }
  };
  const back = () => {
    if (window.history.state?.raMeView && window.history.state.raMeView !== 'main') window.history.back();
    else setView('main');
  };
  const isNormalUser = (user?.role || 'user') === 'user';
  const hasChannel = Boolean(user?.channelNumber);

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('This image can’t be uploaded. Please choose another image.'); return; }
    setUploadingAvatar(true);
    try {
      const upload = await uploadAPI.media(file);
      const avatarUrl = upload.data.data.url;
      await api.put('/auth/profile', { avatarUrl });
      await loadUser();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change profile image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCreateChannel = async () => {
    setCreatingChannel(true);
    setChannelError('');
    try {
      await api.post('/auth/channel', { channelName: channelName.trim() || user?.fullName || user?.username || 'My Channel' });
      setChannelName('');
      await loadUser();
    } catch (err) {
      setChannelError(err.response?.data?.message || 'Failed to create channel');
    } finally {
      setCreatingChannel(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (view === 'profileOverview') return <ProfileOverviewPage user={user} onBack={back} onUpdated={loadUser} />;
  if (view === 'analytics') return (
    <AnalyticsHubPage
      user={user}
      onBack={back}
      onOpenViews={() => goView('totalViews')}
      onOpenFollowers={() => goView('followers')}
      onOpenRevenue={() => goView('adRevenue')}
    />
  );
  if (view === 'totalViews') return <TotalViewsPage user={user} onBack={() => goView('analytics')} />;
  if (view === 'followers') return <FollowersAnalyticsPage user={user} onBack={() => goView('analytics')} />;
  if (view === 'adRevenue') return <AdRevenuePage user={user} onBack={() => goView('analytics')} />;
  if (view === 'scheduler') return <PostSchedulerPage onBack={back} />;
  if (view === 'brandCollab') return <BrandCollabPage user={user} onBack={back} />;
  if (view === 'billing') return <BillingEarningsPage user={user} onBack={back} />;
  if (view === 'monetization') return <MonetizationPage onBack={back} />;
  if (view === 'archive') return <ContentArchivePage user={user} onBack={back} />;
  if (view === 'security') return <AccountSecurityPage onBack={back} />;
  if (view === 'privacy') return <PrivacyVisibilityPage onBack={back} />;
  if (view === 'notifications') return <NotificationsSettingsPage onBack={back} />;
  if (view === 'interface') return <InterfaceAccessibilityPage onBack={back} />;
  if (view === 'help') return <HelpSupportPage onBack={back} />;
  if (view === 'accountData') return <AccountDataPage onBack={back} onDeleted={() => onLogout?.()} />;
  if (view === 'saved') return <SavedPostsPage onBack={back} />;
  if (view === 'watch-history') return <WatchHistoryPage onBack={back} />;
  if (view === 'creator-dashboard') return <CreatorDashboardPage onBack={back} />;
  if (view === 'creator-ads') return <CreatorAdsPage user={user} onBack={back} />;

  const postsCount = user?.postsCount ?? user?.posts?.length ?? 0;
  const followersCount = user?.followersCount ?? user?.followers?.length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-blue-50 pb-24">
      <div className="relative bg-gradient-to-r from-pink-500 to-blue-500 px-4 pt-6 pb-8 text-white">
        <h1 className="text-lg font-bold text-center mb-4">RA Social Studio</h1>
        {onBack && (
          <button onClick={onBack} className="absolute top-6 left-4 text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <div className="flex flex-col items-center">
          <div className="relative mb-2">
            <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center text-2xl font-bold overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (user?.fullName?.[0] || user?.username?.[0] || 'U').toUpperCase()
              )}
            </div>
            <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} aria-label="Change profile photo" className="absolute -right-1 -bottom-1 w-9 h-9 rounded-full bg-white text-purple-600 border-2 border-white shadow-md flex items-center justify-center disabled:opacity-60">
              <Camera className="w-4 h-4" />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          {uploadingAvatar && <p className="text-xs opacity-80 mb-1">Uploading photo…</p>}
          <p className="font-bold text-lg">{user?.fullName || user?.username}</p>
          <p className="text-sm opacity-80">@{user?.username} · {hasChannel ? 'Creator' : 'User'}</p>
        </div>
      </div>

      <div className="px-4 -mt-4">
        <p className="text-xs text-gray-400 uppercase font-semibold mb-2 mt-4">Channel Performance & Stats</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-pink-500 text-xs font-semibold mb-1">
              <Film className="w-4 h-4" /> TOTAL CONTENT
            </div>
            <p className="text-2xl font-bold text-gray-800">{postsCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-purple-500 text-xs font-semibold mb-1">
              <Users2 className="w-4 h-4" /> FOLLOWERS
            </div>
            <p className="text-2xl font-bold text-gray-800">{followersCount}</p>
          </div>
          <button
            onClick={() => hasChannel && goView('analytics')}
            disabled={!hasChannel}
            className={`col-span-2 bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between text-left ${!hasChannel ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div className={`flex items-center gap-2 text-sm font-semibold ${hasChannel ? 'text-blue-500' : 'text-gray-400'}`}>
              {hasChannel ? <BarChart3 className="w-4 h-4" /> : <LockKeyhole className="w-4 h-4" />}
              {hasChannel ? 'View Full Analytics' : 'Analytics — Create a channel first'}
            </div>
            {hasChannel && <ChevronRight className="w-4 h-4 text-gray-300" />}
          </button>
        </div>

        {isNormalUser && !hasChannel && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-5 border border-dashed border-purple-200">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-blue-500 flex items-center justify-center shrink-0">
                <PlusCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-gray-800">Create your channel</h2>
                <p className="text-xs text-gray-500 mt-1">Create a free creator channel. Your unique channel number will be generated automatically.</p>
                <input
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder={user?.fullName || 'Channel name'}
                  maxLength={80}
                  className="w-full mt-3 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                />
                {channelError && <p className="text-xs text-red-500 mt-2">{channelError}</p>}
                <button
                  onClick={handleCreateChannel}
                  disabled={creatingChannel}
                  className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-blue-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {creatingChannel ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {hasChannel && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Clapperboard className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 uppercase font-semibold">Creator Channel</p>
                <p className="font-bold text-gray-800 truncate">{user.channelName}</p>
                <p className="text-xs text-gray-500">Channel No: {user.channelNumber}</p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Active</span>
            </div>
          </div>
        )}

        {hasChannel && (
          <button onClick={() => goView('creator-dashboard')} className="w-full bg-white rounded-2xl shadow-sm p-4 mb-3 flex items-center gap-3 text-left hover:bg-blue-50 border border-blue-100">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-white" /></div>
            <div className="flex-1"><p className="font-bold text-gray-800">Creator Dashboard</p><p className="text-xs text-gray-500">Live content, views, followers, earnings & creator tools</p></div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        )}

        {hasChannel && (
          <button onClick={() => goView('creator-ads')} className="w-full bg-white rounded-2xl shadow-sm p-4 mb-3 flex items-center gap-3 text-left hover:bg-purple-50 border border-purple-100">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center"><Megaphone className="w-5 h-5 text-white" /></div>
            <div className="flex-1"><p className="font-bold text-gray-800">Creator Ads</p><p className="text-xs text-gray-500">Create, upload, edit and manage ads — shown on Home + Reels</p></div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        )}

        <button onClick={() => onOpenDrafts?.()} className="w-full bg-white rounded-2xl shadow-sm p-4 mb-3 flex items-center gap-3 text-left hover:bg-purple-50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center"><FileText className="w-5 h-5 text-white" /></div>
          <div className="flex-1"><p className="font-bold text-gray-800">Drafts</p><p className="text-xs text-gray-500">Continue posts you saved for later</p></div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>

        <button onClick={() => onOpenReportHistory?.()} className="w-full bg-white rounded-2xl shadow-sm p-4 mb-3 flex items-center gap-3 text-left hover:bg-red-50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center"><Flag className="w-5 h-5 text-white" /></div>
          <div className="flex-1"><p className="font-bold text-gray-800">Report History</p><p className="text-xs text-gray-500">Track the posts you reported</p></div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>

        <button onClick={() => goView('saved')} className="w-full bg-white rounded-2xl shadow-sm p-4 mb-5 flex items-center gap-3 text-left hover:bg-purple-50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"><Bookmark className="w-5 h-5 text-white" /></div>
          <div className="flex-1"><p className="font-bold text-gray-800">Saved</p><p className="text-xs text-gray-500">Your saved posts and reels</p></div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>

        <button onClick={() => goView('watch-history')} className="w-full bg-white rounded-2xl shadow-sm p-4 mb-5 flex items-center gap-3 text-left hover:bg-blue-50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center"><Clock3 className="w-5 h-5 text-white" /></div>
          <div className="flex-1"><p className="font-bold text-gray-800">Watch History</p><p className="text-xs text-gray-500">Videos, reels & posts you viewed — last 30 days</p></div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>

        <p className="text-xs text-gray-400 uppercase font-semibold mb-2">{hasChannel ? 'Creator Dashboard' : 'Dashboard Management & Settings'}</p>
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 mb-4">
          {creatorMenuItems.map(({ key, label, icon: Icon, color }) => {
            const enabled = hasChannel;
            return (
              <button
                key={key}
                onClick={() => enabled && goView(key)}
                disabled={!enabled}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="flex-1 font-medium text-gray-700 text-sm">{label}</span>
                {enabled ? <ChevronRight className="w-4 h-4 text-gray-300" /> : <LockKeyhole className="w-4 h-4 text-gray-300" />}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Account Settings</p>
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 mb-4">
          {accountMenuItems.map(({ key, label, icon: Icon, color }) => (
            <button key={key} onClick={() => goView(key)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${color} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="flex-1 font-medium text-gray-700 text-sm">{label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          ))}
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-sm text-red-500 font-medium"
        >
          <LogOut className="w-5 h-5" /> Logout Account
        </button>
      </div>
    </div>
  );
}
