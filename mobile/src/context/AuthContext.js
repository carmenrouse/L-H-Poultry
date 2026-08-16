import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import client, { TOKEN_KEY, apiErrorMessage } from '../api/client';

const AuthContext = createContext(null);

const ROLE_RANK = { CASHIER: 1, MANAGER: 2, OWNER: 3 };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          const { data } = await client.get('/auth/me');
          setUser(data.user);
        }
      } catch (err) {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await client.post('/auth/login', { email, password });
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err) };
    }
  }, []);

  const registerBusiness = useCallback(async (payload) => {
    try {
      const { data } = await client.post('/auth/register-business', payload);
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err) };
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (minRole) => !!user && ROLE_RANK[user.role] >= ROLE_RANK[minRole],
    [user]
  );

  const value = useMemo(
    () => ({ user, booting, login, registerBusiness, logout, hasRole }),
    [user, booting, login, registerBusiness, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
