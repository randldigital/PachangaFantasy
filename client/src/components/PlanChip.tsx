import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export default function PlanChip({ type, id }: { type: "league" | "club"; id: number }) {
  const { data } = useQuery<{ planName: string }>({
    queryKey: queryKeys.billingSubject(type, id),
    queryFn: () => api.get(`/api/billing/subject/${type}/${id}`),
  });
  if (!data) return null;
  return <Badge variant="secondary" className="bg-slate-700 text-slate-200">Plan: {data.planName}</Badge>;
}
