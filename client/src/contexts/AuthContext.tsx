import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { User, InsertUser } from '@shared/schema';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: InsertUser) => Promise<{ email: string }>;
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

  useEffect(() => {
    if (error && token) {
      setToken(null);
      localStorage.removeItem('token');
    }
  }, [error, token]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return api.post<AuthPayload>('/api/auth/login', { email, password });
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      queryClient.setQueryData(queryKeys.me, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      return api.post<{ email: string; code: string }>('/api/auth/register', userData);
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const register = async (userData: InsertUser) => {
    const result = await registerMutation.mutateAsync(userData);
    return { email: result.email };
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    queryClient.clear();
  };

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

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
