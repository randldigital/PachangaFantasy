import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthShell from "@/components/AuthShell";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { apiUrl } from "@/lib/apiBase";
import { describeApiError, parseApiErrorBody } from "@/lib/apiError";

const STORAGE_KEY = "pachanga.analytics.passcode";

type PulseKind =
  | "fantasy_competition"
  | "club_competition"
  | "fantasy_match"
  | "club_match"
  | "valuation";

type AnalyticsOverview = {
  generatedAt: string;
  hero: {
    accounts: { total: number; pending: number; last30Days: number };
    competitions: { total: number; valuating: number; last30Days: number };
    matchesPlayed: { total: number; inProgress: number; last30Days: number };
    ratings: { total: number };
  };
  engagement: {
    valuations: { total: number; last7Days: number; last30Days: number };
    lineups: { total: number };
    statReports: { total: number };
    activeGroups: { total: number };
    accounts: { last7Days: number; last30Days: number };
    competitions: { last7Days: number; last30Days: number };
    matches: { last7Days: number; last30Days: number };
  };
  mix: {
    competitions: { fantasy: number; club: number };
    matches: { fantasy: number; club: number };
    players: { linked: number; guests: number };
  };
  pulse: Array<{
    kind: PulseKind;
    at: string;
    memberCount?: number;
    status?: string;
  }>;
};

async function loadOverview(passcode: string): Promise<AnalyticsOverview> {
  const response = await fetch(apiUrl("/api/analytics/overview"), {
    headers: { "X-Analytics-Passcode": passcode },
    credentials: "include",
  });
  if (!response.ok) {
    throw parseApiErrorBody(response.status, await response.text());
  }
  return response.json() as Promise<AnalyticsOverview>;
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default function Analytics() {
  const { t } = useTranslation();
  const [passcode, setPasscode] = useState("");
  const [stored, setStored] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) setStored(existing);
  }, []);

  useEffect(() => {
    if (!stored) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadOverview(stored)
      .then((overview) => {
        if (!cancelled) setData(overview);
      })
      .catch((err) => {
        if (cancelled) return;
        sessionStorage.removeItem(STORAGE_KEY);
        setStored(null);
        setData(null);
        setError(describeApiError(err, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stored, t]);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const overview = await loadOverview(passcode);
      sessionStorage.setItem(STORAGE_KEY, passcode);
      setStored(passcode);
      setData(overview);
    } catch (err) {
      setError(describeApiError(err, t));
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <AuthShell title={t("analytics.title")} subtitle={t("analytics.subtitle")}>
        <form onSubmit={unlock} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="analytics-passcode">{t("analytics.passcodeLabel")}</Label>
            <Input
              id="analytics-passcode"
              type="password"
              autoComplete="off"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
            />
          </div>
          {error ? <p className="text-red-400 text-sm">{error}</p> : null}
          <Button type="submit" disabled={loading || !passcode} className="w-full bg-accent-blue text-white">
            {loading ? t("common.loading") : t("analytics.unlock")}
          </Button>
        </form>
      </AuthShell>
    );
  }

  const matchStatus = (status?: string) =>
    status ? t(`match.status.${status}`, { defaultValue: status }) : "";

  const pulseLabel = (item: AnalyticsOverview["pulse"][number]) => {
    if (item.kind === "fantasy_competition") {
      return t("analytics.pulseFantasyCompetition", { count: item.memberCount ?? 0 });
    }
    if (item.kind === "club_competition") {
      return t("analytics.pulseClubCompetition", { count: item.memberCount ?? 0 });
    }
    if (item.kind === "fantasy_match") {
      return t("analytics.pulseFantasyMatch", { status: matchStatus(item.status) });
    }
    if (item.kind === "club_match") {
      return t("analytics.pulseClubMatch", { status: matchStatus(item.status) });
    }
    return t("analytics.pulseValuation");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="container mx-auto px-4 py-10 space-y-8 max-w-6xl">
        <div>
          <h1 className="text-3xl font-bold text-white">{t("analytics.title")}</h1>
          <p className="text-slate-400 mt-1">{t("analytics.subtitle")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title={t("analytics.heroAccounts")}
            value={data.hero.accounts.total}
            hint={t("analytics.heroAccountsHint", { pending: data.hero.accounts.pending })}
            delta={data.hero.accounts.last30Days}
            deltaLabel={t("analytics.last30", { count: data.hero.accounts.last30Days })}
          />
          <KpiCard
            title={t("analytics.heroCompetitions")}
            value={data.hero.competitions.total}
            hint={t("analytics.heroCompetitionsHint", { valuating: data.hero.competitions.valuating })}
            delta={data.hero.competitions.last30Days}
            deltaLabel={t("analytics.last30", { count: data.hero.competitions.last30Days })}
          />
          <KpiCard
            title={t("analytics.heroMatches")}
            value={data.hero.matchesPlayed.total}
            hint={t("analytics.heroMatchesHint", { inProgress: data.hero.matchesPlayed.inProgress })}
            delta={data.hero.matchesPlayed.last30Days}
            deltaLabel={t("analytics.last30", { count: data.hero.matchesPlayed.last30Days })}
          />
          <KpiCard
            title={t("analytics.heroRatings")}
            value={data.hero.ratings.total}
            hint={t("analytics.heroRatingsHint")}
          />
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">{t("analytics.engagementTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={t("analytics.valuations")}
              value={data.engagement.valuations.total}
              window={t("analytics.window", {
                seven: data.engagement.valuations.last7Days,
                thirty: data.engagement.valuations.last30Days,
              })}
            />
            <StatCard title={t("analytics.lineups")} value={data.engagement.lineups.total} />
            <StatCard title={t("analytics.statReports")} value={data.engagement.statReports.total} />
            <StatCard title={t("analytics.activeGroups")} value={data.engagement.activeGroups.total} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title={t("analytics.heroAccounts")}
              window={t("analytics.window", {
                seven: data.engagement.accounts.last7Days,
                thirty: data.engagement.accounts.last30Days,
              })}
            />
            <StatCard
              title={t("analytics.heroCompetitions")}
              window={t("analytics.window", {
                seven: data.engagement.competitions.last7Days,
                thirty: data.engagement.competitions.last30Days,
              })}
            />
            <StatCard
              title={t("analytics.heroMatches")}
              window={t("analytics.window", {
                seven: data.engagement.matches.last7Days,
                thirty: data.engagement.matches.last30Days,
              })}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">{t("analytics.mixTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <MixCard
              title={t("analytics.heroCompetitions")}
              leftLabel={t("analytics.fantasy")}
              left={data.mix.competitions.fantasy}
              rightLabel={t("analytics.club")}
              right={data.mix.competitions.club}
            />
            <MixCard
              title={t("analytics.heroMatches")}
              leftLabel={t("analytics.fantasy")}
              left={data.mix.matches.fantasy}
              rightLabel={t("analytics.club")}
              right={data.mix.matches.club}
            />
            <MixCard
              title={t("analytics.players")}
              leftLabel={t("analytics.linkedPlayers")}
              left={data.mix.players.linked}
              rightLabel={t("analytics.guestPlayers")}
              right={data.mix.players.guests}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">{t("analytics.pulseTitle")}</h2>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-0">
              {data.pulse.length === 0 ? (
                <p className="p-6 text-slate-400">{t("analytics.pulseEmpty")}</p>
              ) : (
                <ul className="divide-y divide-slate-700">
                  {data.pulse.map((item, index) => {
                    const days = daysSince(item.at);
                    return (
                      <li
                        key={`${item.kind}-${item.at}-${index}`}
                        className="flex items-center justify-between gap-4 px-6 py-3 text-sm"
                      >
                        <span className="text-white">{pulseLabel(item)}</span>
                        <span className="text-slate-400 shrink-0">
                          {days === 0
                            ? t("analytics.pulseToday")
                            : t("analytics.pulseDaysAgo", { count: days })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  delta,
  deltaLabel,
}: {
  title: string;
  value: number;
  hint: string;
  delta?: number;
  deltaLabel?: string;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-4xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-400">{hint}</p>
        {delta != null && deltaLabel ? (
          <p className="text-xs text-emerald-400">{deltaLabel}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatCard({
  title,
  value,
  window,
}: {
  title: string;
  value?: number;
  window?: string;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-5 space-y-1">
        <p className="text-sm text-slate-400">{title}</p>
        {value != null ? <p className="text-2xl font-semibold text-white">{value}</p> : null}
        {window ? <p className="text-xs text-slate-500">{window}</p> : null}
      </CardContent>
    </Card>
  );
}

function MixCard({
  title,
  leftLabel,
  left,
  rightLabel,
  right,
}: {
  title: string;
  leftLabel: string;
  left: number;
  rightLabel: string;
  right: number;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-5 space-y-3">
        <p className="text-sm text-slate-400">{title}</p>
        <div className="flex justify-between text-white">
          <span>
            {leftLabel}: <strong>{left}</strong>
          </span>
          <span>
            {rightLabel}: <strong>{right}</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
