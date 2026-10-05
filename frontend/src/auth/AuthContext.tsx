import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from '../services/api';

export interface AuthUser {
  user_id: string;
  name: string;
  email: string;
  role: 'procurement_officer' | 'reviewer' | 'admin';
  organization: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, organization?: string) => Promise<void>;
  logout: () => void;
  canReview: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  canReview: false,
});

const TOKEN_KEY = 'vendorguard_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  // Session bootstrap: validate any stored token against /auth/me
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.getMe()
      .then(setUser)
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, []);

  // Any 401 from the API ends the session and shows the login page
  useEffect(() => {
    setUnauthorizedHandler(() => clearSession());
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    setUser(res.user);
  };

  const register = async (name: string, email: string, password: string, organization?: string) => {
    const res = await api.register(name, email, password, organization);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    setUser(res.user);
  };

  const logout = () => clearSession();

  const canReview = user?.role === 'reviewer' || user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, canReview }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
