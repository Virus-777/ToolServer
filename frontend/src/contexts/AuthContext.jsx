import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AdminAuthAPI, UNAUTHORIZED_EVENT, getToken, getUser } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(() => getUser());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    AdminAuthAPI.logout();
    setUserState(null);
    setIsAuthenticated(false);
  }, []);

  // Validate the stored session once on start-up and react to rejected tokens
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      if (getToken() && getUser()) {
        try {
          const data = await AdminAuthAPI.verify();
          if (!cancelled) {
            setUserState(data.user || getUser());
            setIsAuthenticated(true);
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          if (!cancelled) clearSession();
        }
      }
      if (!cancelled) setLoading(false);
    };

    checkAuth();

    window.addEventListener(UNAUTHORIZED_EVENT, clearSession);
    return () => {
      cancelled = true;
      window.removeEventListener(UNAUTHORIZED_EVENT, clearSession);
    };
  }, [clearSession]);

  const login = useCallback(async (email, password) => {
    const data = await AdminAuthAPI.login(email, password);
    setUserState(data.user);
    setIsAuthenticated(true);
    return data;
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated, loading, login, logout: clearSession }),
    [user, isAuthenticated, loading, login, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
