import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export type AuthFeatures = {
  google: boolean;
  payments: boolean;
  ads: boolean;
  email: boolean;
};

export function useAuthFeatures() {
  return useQuery<AuthFeatures>({
    queryKey: queryKeys.authFeatures,
    queryFn: () => api.get<AuthFeatures>("/api/auth/features"),
    staleTime: 60_000,
  });
}

export function isAdsEnabled(features: { ads?: boolean } | null | undefined): boolean {
  return Boolean(features?.ads);
}

export function isPaymentsEnabled(features: { payments?: boolean } | null | undefined): boolean {
  return Boolean(features?.payments);
}
