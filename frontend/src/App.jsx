import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Home, Film, Plus, Sparkles, MessageCircle, User, Search, Bell, X } from 'lucide-react';
import { postAPI, notificationAPI } from './services/api';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import OtpVerificationPage from './pages/OtpVerificationPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TwoFactorLoginPage from './pages/TwoFactorLoginPage';
import SearchPage from './pages/SearchPage';
import PublicProfilePage from './pages/PublicProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import ChatPage from './pages/ChatPage';
import ReelsPage from './pages/ReelsPage';
import AIFeatures from './pages/AIFeatures';
import MePage from './pages/MePage';
import SavedPostsPage from './pages/SavedPostsPage';
import DraftsPage from './pages/DraftsPage';
import HashtagPage from './pages/HashtagPage';
import ReportHistoryPage from './pages/ReportHistoryPage';
import WatchHistoryPage from './pages/WatchHistoryPage';
import { applyInterfacePrefs } from './pages/settings/InterfaceAccessibilityPage';

// Components
import CreatePostModal from './components/CreatePostModal';
import PostCard from './components/PostCard';
import InstallPrompt from './components/InstallPrompt';
import GuestProfilePage from './pages/GuestProfilePage';

function AppContent() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [posts, setPosts] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [feedRefresh, setFeedRefresh] = useState(0);
  const [reelTarget, setReelTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSource, setSearchSource] = useState('home');
  const [contextSearchQuery, setContextSearchQuery] = useState('');
  const [contextSearchOpen, setContextSearchOpen] = useState(false);
  const [publicProfileId, setPublicProfileId] = useState(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [savedReturnTab, setSavedReturnTab] = useState('me');
  const [draftToEdit, setDraftToEdit] = useState(null);
  const [hashtagName, setHashtagName] = useState('');
  const [reportHistory, setReportHistory] = useState(false);
  const historyReadyRef = useRef(false);
  const suppressHistoryRef = useRef(false);

  // Keep the app's tab navigation in the browser history so Android/iOS
  // hardware back returns to the previous in-app screen instead of leaving
  // the SPA.
  const navigateTab = (nextTab, options = {}) => {
    const tab = nextTab || 'home';
    setActiveTab(tab);
    if (!historyReadyRef.current) return;
    if (options.replace) {
      window.history.replaceState({ ...(window.history.state || {}), raTab: tab }, '', window.location.href);
    } else if (!suppressHistoryRef.current) {
      window.history.pushState({ ...(window.history.state || {}), raTab: tab }, '', window.location.href);
    }
  };

  useEffect(() => {
    const initial = window.history.state?.raTab || 'home';
    window.history.replaceState({ ...(window.history.state || {}), raTab: initial }, '', window.location.href);
    historyReadyRef.current = true;
    const onPopState = (event) => {
      const previous = event.state?.raTab || 'home';
      suppressHistoryRef.current = true;
      setShowCreateModal(false);
      setShowLoginPrompt(false);
      setDraftToEdit(null);
      setActiveTab(previous);
      window.setTimeout(() => { suppressHistoryRef.current = false; }, 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!historyReadyRef.current || suppressHistoryRef.current) return;
    const current = window.history.state?.raTab;
    if (current !== activeTab) {
      window.history.pushState({ ...(window.history.state || {}), raTab: activeTab }, '', window.location.href);
    }
  }, [activeTab]);

  const openSearch = (query = '') => {
    const value = typeof query === 'string' ? query : '';
    // Search always stays inside the currently visible page. Never navigate
    // to a separate/global search screen. Each page consumes contextSearchQuery
    // and filters only its own content.
    setSearchSource(activeTab);
    setSearchQuery(value.trim());
    setContextSearchQuery(value);
    setContextSearchOpen(true);
  };

  const closeContextSearch = () => {
    setContextSearchOpen(false);
    setContextSearchQuery('');
  };

  // Never carry a search term from one page into another page.
  useEffect(() => {
    setContextSearchQuery('');
    setContextSearchOpen(false);
  }, [activeTab]);

  const openProfile = (id) => { setPublicProfileId(id); navigateTab('public-profile'); };

  const openHashtag = (name) => { setHashtagName(String(name || '').replace(/^#/, '')); navigateTab('hashtag'); };

  const openReel = (post) => {
    setReelTarget(post);
    navigateTab('reels');
  };

  useEffect(() => {
    if (!user) {
      setUnreadNotificationCount(0);
      return undefined;
    }

    const refreshUnreadNotifications = async () => {
      try {
        const response = await notificationAPI.getNotifications();
        setUnreadNotificationCount(Number(response.data?.data?.unreadCount || 0));
      } catch (error) {
        console.error('Failed to fetch notification count:', error);
      }
    };

    refreshUnreadNotifications();
    const handleNotificationUpdate = () => refreshUnreadNotifications();
    window.addEventListener('ra:notifications-updated', handleNotificationUpdate);
    const intervalId = window.setInterval(refreshUnreadNotifications, 30000);
    return () => {
      window.removeEventListener('ra:notifications-updated', handleNotificationUpdate);
      window.clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ra_social_interface'));
      if (saved) applyInterfacePrefs(saved);
    } catch {
      /* no saved prefs yet */
    }
  }, []);

  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get('post');
    if (postId) {
      setReelTarget({ id: postId });
      navigateTab('reels');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!user && ['/login', '/register', '/forgot-password', '/verify-otp', '/reset-password', '/2fa-login'].includes(window.location.pathname)) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-otp" element={<OtpVerificationPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/2fa-login" element={<TwoFactorLoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const requireLogin = () => {
    if (!user) setShowLoginPrompt(true);
  };

  const continueToLogin = () => {
    setShowLoginPrompt(false);
    window.location.assign('/login');
  };

  const isFullScreenTab = activeTab === 'reels' || activeTab === 'me';
  // Search is an inline control; it must never become its own page.
  const hideTopBar = isFullScreenTab;

  return (
    <div className="min-h-screen bg-gray-50">
      {!hideTopBar && (
        <TopBar
          logout={logout}
          onNotifications={() => navigateTab('notifications')}
          unreadNotificationCount={unreadNotificationCount}
          onSearch={openSearch}
          searchOpen={contextSearchOpen}
          searchQuery={contextSearchQuery}
          onSearchChange={setContextSearchQuery}
          onCloseSearch={closeContextSearch}
          onProfile={() => navigateTab('me')}
        />
      )}

      <main className={isFullScreenTab ? '' : 'pb-20'}>
        {activeTab === 'home' && <HomeFeed posts={posts} setPosts={setPosts} refreshKey={feedRefresh} onOpenReel={openReel} searchQuery={contextSearchQuery} />}
        {activeTab === 'reels' && <ReelsPage onNotifications={() => navigateTab('notifications')} unreadNotificationCount={unreadNotificationCount} onSearch={openSearch} searchOpen={contextSearchOpen} searchQuery={contextSearchQuery} onSearchChange={setContextSearchQuery} onCloseSearch={closeContextSearch} initialPostId={reelTarget?.id} />}
        {activeTab === 'ai' && (user ? <AIFeatures searchQuery={contextSearchQuery} /> : <GuestLoginGate title="AI" onLogin={requireLogin} />)}
        {activeTab === 'chat' && (user ? <ChatPage searchQuery={contextSearchQuery} /> : <GuestLoginGate title="Chat" onLogin={requireLogin} />)}
        {activeTab === 'me' && (user ? <MePage onLogout={logout} onOpenReportHistory={() => navigateTab('report-history')} onBack={() => navigateTab('home')} onOpenDrafts={() => navigateTab('drafts')} /> : <GuestProfilePage onLogin={requireLogin} />)}
        {activeTab === 'notifications' && <NotificationsPage searchQuery={contextSearchQuery} />}
        {activeTab === 'search' && <SearchPage initialQuery={searchQuery} source={searchSource} onBack={() => navigateTab(searchSource || 'home')} onOpenProfile={openProfile} onOpenHashtag={openHashtag} />}
        {activeTab === 'saved' && <SavedPostsPage onBack={() => navigateTab(savedReturnTab)} searchQuery={contextSearchQuery} />}
        {activeTab === 'drafts' && <DraftsPage userId={user?.id} onBack={() => navigateTab('me')} onEdit={(draft) => { setDraftToEdit(draft); setShowCreateModal(true); navigateTab('home'); }} searchQuery={contextSearchQuery} />}
        {activeTab === 'report-history' && <ReportHistoryPage onBack={() => navigateTab('me')} searchQuery={contextSearchQuery} />}
        {activeTab === 'watch-history' && <WatchHistoryPage onBack={() => navigateTab('me')} searchQuery={contextSearchQuery} />}
        {activeTab === 'hashtag' && <HashtagPage name={hashtagName} onBack={() => navigateTab(searchSource || 'home')} onOpenReel={openReel} />}
        {activeTab === 'public-profile' && <PublicProfilePage userId={publicProfileId} onBack={() => navigateTab(searchSource || 'home')} />}
      </main>

      {showCreateModal && (
        <CreatePostModal userId={user?.id} isCreator={Boolean(user?.channelNumber)} initialDraft={draftToEdit} onClose={() => { setShowCreateModal(false); setDraftToEdit(null); }} onDraftSaved={() => {}} onPostCreated={() => setFeedRefresh((prev) => prev + 1)} />
      )}

      {showLoginPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-5" onClick={() => setShowLoginPrompt(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Login Required</h3>
              <button onClick={() => setShowLoginPrompt(false)} aria-label="Close" className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-600">Please login to continue.</p>
            <button onClick={continueToLogin} className="mt-5 w-full rounded-xl bg-gradient-to-r from-pink-500 to-blue-500 px-5 py-3 font-semibold text-white">
              OK
            </button>
          </div>
        </div>
      )}

      <BottomNav activeTab={activeTab} setActiveTab={navigateTab} setShowCreateModal={setShowCreateModal} isFullScreenTab={isFullScreenTab} isAuthenticated={Boolean(user)} onRequireLogin={requireLogin} />
      {activeTab === 'me' && (
        <button onClick={() => openSearch('')} aria-label="Search" className="fixed right-4 top-4 z-[70] w-11 h-11 rounded-full bg-white/95 shadow-lg border flex items-center justify-center">
          <Search className="w-5 h-5 text-gray-700" />
        </button>
      )}
      <InstallPrompt />
    </div>
  );
}

function TopBar({ onNotifications, unreadNotificationCount, onSearch, searchOpen, searchQuery, onSearchChange, onCloseSearch, onProfile }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <div className="w-auto min-w-[78px] shrink-0 text-left font-extrabold text-base sm:text-lg tracking-tight text-gray-900 whitespace-nowrap" aria-label="RA Social">
          RA Social
        </div>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-gray-400" />
          {searchOpen ? (
            <div className="relative w-full">
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') onCloseSearch(); }}
                placeholder="Search this page"
                aria-label="Search this page"
                className="block h-10 w-full rounded-full bg-gray-100 pl-10 pr-10 text-sm leading-5 outline-none transition focus:bg-white focus:ring-2 focus:ring-purple-300"
              />
              <button onClick={onCloseSearch} aria-label="Close search" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full hover:bg-gray-200">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          ) : (
            <button onClick={() => onSearch('')} className="block h-10 w-full rounded-full bg-gray-100 pl-10 pr-4 text-left text-sm leading-5 text-gray-500 transition hover:bg-gray-200" aria-label="Search this page">
              Search
            </button>
          )}
        </div>

        <button onClick={onNotifications} aria-label="Notifications" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100">
          <Bell className="h-6 w-6 text-gray-700" />
          {unreadNotificationCount > 0 && (
            <span className="absolute right-0 top-0 min-w-[18px] h-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </span>
          )}
        </button>

        <button onClick={onProfile} aria-label="My Profile" className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-blue-500 text-sm font-bold text-white">
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function GuestLoginGate({ title, onLogin }) {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-6 pt-16 pb-24 bg-gray-50">
      <div className="w-full max-w-md rounded-3xl bg-white border border-gray-200 shadow-sm p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Login to use {title}</h2>
        <p className="mt-2 text-sm text-gray-500">Please login to continue.</p>
        <button onClick={onLogin} className="mt-6 w-full rounded-xl bg-gradient-to-r from-pink-500 to-blue-500 px-5 py-3 font-semibold text-white">Login</button>
      </div>
    </div>
  );
}

function BottomNav({ activeTab, setActiveTab, setShowCreateModal, isFullScreenTab, isAuthenticated, onRequireLogin }) {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'reels', icon: Film, label: 'Reels' },
    { id: 'create', icon: Plus, label: 'Create', isSpecial: true },
    { id: 'ai', icon: Sparkles, label: 'AI' },
    { id: 'chat', icon: MessageCircle, label: 'Chat' }
  ];

  const handleNavClick = (itemId) => {
    if (itemId === 'ai' || itemId === 'chat') {
      if (!isAuthenticated) {
        onRequireLogin();
        return;
      }
      setActiveTab(itemId);
      return;
    }
    if (itemId === 'create') {
      setShowCreateModal(true);
    } else {
      setActiveTab(itemId);
    }
  };

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 ${isFullScreenTab ? 'bg-black/40 backdrop-blur-sm' : 'bg-white border-t border-gray-200'}`}>
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`flex flex-col items-center p-2 ${
              item.isSpecial 
                ? 'bg-gradient-to-r from-pink-500 to-blue-500 rounded-full p-3 -mt-4 shadow-lg' 
                : activeTab === item.id 
                  ? (isFullScreenTab ? 'text-white' : 'text-pink-600')
                  : (isFullScreenTab ? 'text-gray-300' : 'text-gray-500')
            }`}
          >
            <item.icon className={`w-6 h-6 ${item.isSpecial ? 'text-white' : ''}`} />
            {!item.isSpecial && <span className="text-xs mt-1">{item.label}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}

function HomeFeed({ posts, setPosts, refreshKey, onOpenReel, searchQuery = '' }) {
  const fetchPosts = async () => {
    try {
      const response = await postAPI.getFeed();
      setPosts(response.data.data);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [refreshKey]);

  const handleLike = async (postId) => {
    try {
      await postAPI.like(postId);
      fetchPosts();
    } catch (error) {
      console.error('Failed to like:', error);
    }
  };

  const q = String(searchQuery || '').trim().toLowerCase();
  const visiblePosts = q ? posts.filter((post) => {
    const haystack = [post.content, post.user?.fullName, post.user?.username, ...(post.hashtags || [])].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  }) : posts;

  return (
    <div className="pt-20 px-4 pb-4 space-y-4">
      {visiblePosts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500">No posts yet. Be the first to post!</p>
        </div>
      ) : (
        visiblePosts.map((post) => (
          <PostCard key={post.id} post={post} onLike={() => handleLike(post.id)} onOpenReel={onOpenReel} />
        ))
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;