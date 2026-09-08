import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { User, InsertUser } from '@shared/schema';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: InsertUser) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthPayload = { user: User; token: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery<{ user: User } | null>({
    queryKey: queryKeys.me,
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!token,
    retry: false,
  });

  // Handle authentication errors
  useEffect(() => {
    if (error && token) {
      console.log('Auth query error, clearing token:', error);
      setToken(null);
      localStorage.removeItem('token');
    }
  }, [error, token]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return api.post<AuthPayload>('/api/auth/login', { email, password });
    },
    onSuccess: (data) => {
      console.log('Login successful, setting token');
      localStorage.setItem('token', data.token);
      setToken(data.token);
      queryClient.setQueryData(queryKeys.me, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      return api.post<AuthPayload>('/api/auth/register', userData);
    },
    onSuccess: (data) => {
      console.log('Register successful, setting token');
      localStorage.setItem('token', data.token);
      setToken(data.token);
      queryClient.setQueryData(queryKeys.me, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const register = async (userData: InsertUser) => {
    await registerMutation.mutateAsync(userData);
  };

  const logout = () => {
    console.log('Logging out, clearing all auth state');
    localStorage.removeItem('token');
    setToken(null);
    queryClient.clear();
  };

  // Add token to API requests
  useEffect(() => {
    if (token) {
      // Store token for apiRequest function to use
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  // Handle case where token exists but user fetch returns null (server restart)
  useEffect(() => {
    if (token && user === null && !isLoading) {
      setToken(null);
    }
  }, [token, user, isLoading]);

  return (
    <AuthContext.Provider
      value={{
        user: user?.user || null,
        login,
        register,
        logout,
        loading: isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
