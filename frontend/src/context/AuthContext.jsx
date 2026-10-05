import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, sessionAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async (isRetry = false) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await authAPI.getMe();
      setUser(response.data.data);
      setLoading(false);
    } catch (error) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        // Token really is invalid/expired — this is the only case that
        // should force a re-login.
        localStorage.removeItem('token');
        setLoading(false);
        return;
      }
      // Network error, timeout, or a 5xx (e.g. the backend is still waking
      // up from a Render free-tier cold start). The token is still fine —
      // retry once after a short delay instead of logging the user out.
      if (!isRetry) {
        setTimeout(() => checkAuth(true), 3000);
        return;
      }
      // Second attempt also failed for a non-auth reason: keep the token
      // (so the next reload can succeed once the backend is up) and just
      // stop the spinner. The user stays logged out for this page load
      // only, not permanently.
      setLoading(false);
    }
  };

  const login = async (identifier, password) => {
    const response = await authAPI.login({ identifier, password });
    const data = response.data.data || {};
    if (data.requiresTwoFactor) return data;
    const { user, token } = data;
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };

  const register = async (username, email, password, fullName, phoneNumber) => {
    const response = await authAPI.register({ username, email, password, fullName, phoneNumber });
    const { user, token } = response.data.data;
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };

  const logout = async () => {
    try { if (localStorage.getItem('token')) await sessionAPI.logout(); } catch (error) { console.warn('Session logout request failed', error); }
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}