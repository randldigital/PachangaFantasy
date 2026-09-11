import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import AdSlot from "@/components/AdSlot";
import { describeApiError } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";

type BillingSubject = {
  billingAccountId: number;
  subjectType: "user" | "league" | "club";
  subjectId: number;
  name: string;
  canManage: boolean;
  planCode: string;
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
};

type PlansResponse = {
  paymentsEnabled: boolean;
  plans: {
    code: string;
    name: string;
    features: string[];
    comparison: { feature: string; included: boolean }[];
  }[];
};

export default function Billing() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const overview = useQuery<{ subjects: BillingSubject[]; paymentsEnabled: boolean }>({
    queryKey: queryKeys.billingOverview,
    queryFn: () => api.get("/api/billing/overview"),
  });
  const catalog = useQuery<PlansResponse>({
    queryKey: queryKeys.billingPlans,
    queryFn: () => api.get("/api/billing/plans"),
  });

  const subjects = overview.data?.subjects ?? [];
  const selected = useMemo(
    () => subjects.find((row) => row.billingAccountId === selectedId) ?? subjects[0],
    [subjects, selectedId],
  );
  const paymentsOn = overview.data?.paymentsEnabled ?? catalog.data?.paymentsEnabled ?? false;

  const checkout = useMutation({
    mutationFn: (input: { billingAccountId: number; planCode: string }) =>
      api.post("/api/billing/checkout", input),
    onError: (error) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">
        <div>
          <h1 className="text-3xl font-bold text-white">{t("billing.title")}</h1>
          <p className="text-slate-400 mt-1">{t("billing.subtitle")}</p>
        </div>
        <AdSlot slot="overview.banner" />

        {subjects.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject) => (
              <Button
                key={subject.billingAccountId}
                size="sm"
                variant={selected?.billingAccountId === subject.billingAccountId ? "default" : "outline"}
                onClick={() => setSelectedId(subject.billingAccountId)}
              >
                {subject.name}
              </Button>
            ))}
          </div>
        )}

        {selected && (
          <Card className="bg-slate-800/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-3">
                {t("billing.currentPlan")}
                <Badge>{selected.planName}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-2 text-sm">
              <p>{t("billing.subject")}: {selected.name}</p>
              <p>{t("billing.status")}: {selected.status}</p>
              {selected.currentPeriodEnd && (
                <p>{t("billing.periodEnd")}: {new Date(selected.currentPeriodEnd).toLocaleDateString()}</p>
              )}
              {!paymentsOn && <p className="text-amber-300">{t("billing.paymentsOff")}</p>}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {(catalog.data?.plans ?? []).map((plan) => (
            <Card key={plan.code} className="bg-slate-800/70 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  {plan.name}
                  <span className="text-sm font-normal text-slate-400">
                    {plan.code === "plus" ? t("billing.comingSoon") : t("billing.included")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1 text-sm text-slate-300">
                  {plan.comparison.map((row) => (
                    <li key={row.feature} className={row.included ? "" : "text-slate-500"}>
                      {row.included ? "✓" : "–"} {t(`billing.features.${row.feature}`, { defaultValue: row.feature })}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  disabled={!paymentsOn || !selected?.canManage || plan.code === selected?.planCode}
                  onClick={() => {
                    if (!selected || !paymentsOn) return;
                    checkout.mutate({ billingAccountId: selected.billingAccountId, planCode: plan.code });
                  }}
                >
                  {plan.code === selected?.planCode ? t("billing.currentCta") : t("billing.upgradeCta")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
