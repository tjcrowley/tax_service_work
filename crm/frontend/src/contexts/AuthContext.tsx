import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ACCESS_TOKEN_KEY, api, setUnauthorizedHandler } from '../lib/api';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'viewer';
};

type LoginResponse = {
  data: {
    accessToken: string;
    user: AuthUser;
  };
};

type MeResponse = {
  data: {
    user: AuthUser;
  };
};

export type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }
    api
      .get<MeResponse>('/auth/me')
      .then((resp) => {
        if (!cancelled) setUser(resp.data.data.user);
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const resp = await api.post<LoginResponse>('/auth/login', { email, password });
    localStorage.setItem(ACCESS_TOKEN_KEY, resp.data.data.accessToken);
    setUser(resp.data.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout — still clear local state
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
