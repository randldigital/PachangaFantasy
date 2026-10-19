import { useState, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Coins, Target, Handshake, Trophy, Crown, Flag, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { formatDisplayMarketValue, formatDisplayMarketValueDelta } from "@shared/domain/displayValue";
import { currentSeasonKey } from "@shared/domain/season";

export type PlayerProfile = {
  player: {
    id: number;
    name: string;
    emoji: string | null;
    userId: number | null;
    leagueId: number | null;
    clubId: number | null;
    marketValue: number;
  };
  season: string | null;
  totals: {
    totalPoints: number;
    goals: number;
    assists: number;
    matchesPlayed: number;
    mvps: number;
    victories: number;
  };
  marketValueHistory: Array<{
    matchId: number;
    date: string;
    seasonKey: string | null;
    vmBefore: number;
    vmAfter: number;
    delta: number;
    goals: number;
    assists: number;
    points: number;
    mvpVotes: number;
    peerAverage: number | null;
    performanceScore: number;
  }>;
};

const chartConfig = {
  vm: { label: "VM", color: "hsl(160, 84%, 39%)" },
} satisfies ChartConfig;

function formatShortDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function PlayerProfileDialog({
  playerId,
  season,
  open,
  onOpenChange,
}: {
  playerId: number | null;
  season?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const seasonKey = season === undefined ? currentSeasonKey() : season;
  const enabled = open && playerId != null;

  const { data, isLoading, isError } = useQuery<PlayerProfile>({
    queryKey: queryKeys.playerProfile(playerId ?? 0, seasonKey),
    queryFn: () => {
      const qs = seasonKey ? `?season=${encodeURIComponent(seasonKey)}` : "";
      return api.get<PlayerProfile>(`/api/players/${playerId}/profile${qs}`);
    },
    enabled,
  });

  const chartData = (() => {
    const history = data?.marketValueHistory ?? [];
    if (history.length === 0) {
      return [];
    }
    const first = history[0];
    return [
      {
        label: t("playerProfile.initial"),
        vm: first.vmBefore,
        delta: 0,
      },
      ...history.map((row) => ({
        label: formatShortDate(String(row.date), i18n.language),
        vm: row.vmAfter,
        delta: row.delta,
      })),
    ];
  })();

  const historyNewestFirst = data ? [...data.marketValueHistory].reverse() : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem))] max-w-lg overflow-y-auto border-slate-700 bg-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <span className="text-2xl leading-none">{data?.player.emoji || "👤"}</span>
            <span className="truncate">{data?.player.name ?? t("playerProfile.loading")}</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-slate-400">{t("common.loading")}</p>
        )}
        {isError && (
          <p className="text-sm text-red-400">{t("playerProfile.loadError")}</p>
        )}

        {data && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-600 bg-slate-900/50 p-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {t("playerProfile.marketValue")}
                </p>
                <p className="flex items-center gap-1.5 text-2xl font-bold text-emerald-400">
                  <Coins className="h-5 w-5" />
                  {formatDisplayMarketValue(data.player.marketValue)}
                </p>
              </div>
              {data.season && (
                <p className="text-sm text-slate-400">
                  {t("playerProfile.season")}: {data.season}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatChip icon={<Trophy className="h-3.5 w-3.5 text-emerald-400" />} label={t("clasificacion.points")} value={data.totals.totalPoints} />
              <StatChip icon={<Target className="h-3.5 w-3.5 text-emerald-400" />} label={t("clasificacion.goals")} value={data.totals.goals} />
              <StatChip icon={<Handshake className="h-3.5 w-3.5 text-sky-400" />} label={t("clasificacion.assists")} value={data.totals.assists} />
              <StatChip icon={<Crown className="h-3.5 w-3.5 text-amber-400" />} label={t("clasificacion.mvps")} value={data.totals.mvps} />
              <StatChip icon={<Flag className="h-3.5 w-3.5 text-violet-400" />} label={t("clasificacion.victories")} value={data.totals.victories} />
              <StatChip icon={<Calendar className="h-3.5 w-3.5 text-slate-400" />} label={t("clasificacion.matches")} value={data.totals.matchesPlayed} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-300">{t("playerProfile.valueEvolution")}</h3>
              {chartData.length === 0 ? (
                <p className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
                  {t("playerProfile.noHistory")}
                </p>
              ) : (
                <ChartContainer config={chartConfig} className="aspect-[16/9] w-full">
                  <LineChart data={chartData} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      domain={["dataMin - 0.5", "dataMax + 0.5"]}
                      tickFormatter={(value) => formatDisplayMarketValue(Number(value))}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) {
                          return null;
                        }
                        const point = payload[0];
                        const label = String(point.payload?.label ?? "");
                        return (
                          <div className="rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-xs shadow-xl">
                            {label ? <p className="text-slate-400">{label}</p> : null}
                            <p className="font-medium tabular-nums text-emerald-400">
                              {formatDisplayMarketValue(Number(point.value))}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="linear"
                      dataKey="vm"
                      stroke="var(--color-vm)"
                      strokeWidth={2}
                      connectNulls
                      isAnimationActive={false}
                      dot={{ r: 3, fill: "var(--color-vm)" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-300">{t("playerProfile.matchHistory")}</h3>
              {historyNewestFirst.length === 0 ? (
                <p className="text-sm text-slate-400">{t("playerProfile.noHistory")}</p>
              ) : (
                <ul className="space-y-2">
                  {historyNewestFirst.map((row) => {
                    const deltaPositive = row.delta > 0;
                    const deltaNegative = row.delta < 0;
                    return (
                      <li
                        key={row.matchId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-white">
                            {formatShortDate(String(row.date), i18n.language)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {row.goals}G · {row.assists}A · {Number.isInteger(row.points) ? row.points : row.points.toFixed(1)}{" "}
                            {t("clasificacion.points")}
                          </p>
                        </div>
                        <div className="text-right tabular-nums">
                          <p className="text-slate-300">
                            {formatDisplayMarketValue(row.vmBefore)}
                            <span className="mx-1 text-slate-500">→</span>
                            {formatDisplayMarketValue(row.vmAfter)}
                          </p>
                          <p
                            className={cn(
                              "text-xs font-medium",
                              deltaPositive && "text-emerald-400",
                              deltaNegative && "text-red-400",
                              !deltaPositive && !deltaNegative && "text-slate-400",
                            )}
                          >
                            {formatDisplayMarketValueDelta(row.delta)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </p>
    </div>
  );
}

/** Clickable player name that opens the profile dialog. */
export function PlayerNameButton({
  playerId,
  name,
  season,
  className,
  stopPropagation = false,
}: {
  playerId: number;
  name: string;
  season?: string | null;
  className?: string;
  stopPropagation?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const onClick = (event: MouseEvent) => {
    if (stopPropagation) {
      event.stopPropagation();
      event.preventDefault();
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "truncate text-left font-medium text-white underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
          className,
        )}
      >
        {name}
      </button>
      <PlayerProfileDialog
        playerId={playerId}
        season={season}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
