import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { apiUrl } from "@/lib/apiBase";
import { parseApiErrorBody } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import type { User, InsertUser } from "@shared/schema";

type AuthPayload = { user: User; token: string };

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: InsertUser) => Promise<{ email: string }>;
  applySession: (payload: AuthPayload) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function meKey(token: string | null) {
  return [...queryKeys.me, token] as const;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const persistToken = useCallback((next: string | null) => {
    setToken(next);
    if (next) {
      localStorage.setItem("token", next);
    } else {
      localStorage.removeItem("token");
      setUser(null);
    }
  }, []);

  const applySession = useCallback(
    (payload: AuthPayload) => {
      setUser(payload.user);
      queryClient.setQueryData(meKey(payload.token), { user: payload.user });
      persistToken(payload.token);
    },
    [queryClient, persistToken],
  );

  const { data, isFetched, isError } = useQuery<{ user: User } | null>({
    queryKey: meKey(token),
    queryFn: async () => {
      if (!token) {
        return null;
      }
      const res = await fetch(apiUrl("/api/auth/me"), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) {
        return null;
      }
      if (!res.ok) {
        throw parseApiErrorBody(res.status, await res.text());
      }
      return (await res.json()) as { user: User };
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data?.user) {
      setUser(data.user);
    }
  }, [data]);

  useEffect(() => {
    if (!token || !isFetched) {
      return;
    }
    if (data === null) {
      persistToken(null);
    }
  }, [token, data, isFetched, persistToken]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return api.post<AuthPayload>("/api/auth/login", { email, password });
    },
    onSuccess: applySession,
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      return api.post<{ email: string; code: string }>("/api/auth/register", userData);
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
    persistToken(null);
    queryClient.removeQueries({ queryKey: queryKeys.me });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        applySession,
        logout,
        loading: Boolean(token) && !user && !isError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
