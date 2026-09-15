import { Crown, Handshake, Target, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import UserAvatar from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { formatDisplayMarketValue, formatDisplayMarketValueDelta } from "@shared/domain/displayValue";

export interface ClubRecapPlayer {
  playerId: number;
  name: string;
  userId?: number | null;
  goals: number;
  assists: number;
  minutes: number | null;
  points: number | null;
  mvpVotes: number;
  isMvp: boolean;
  peerAverage: number | null;
  vmBefore: number | null;
  vmAfter: number | null;
  delta: number | null;
}

interface ClubMatchRecapProps {
  opponentName: string | null;
  ourGoals: number | null;
  opponentGoals: number | null;
  players: ClubRecapPlayer[];
}

export default function ClubMatchRecap({
  opponentName,
  ourGoals,
  opponentGoals,
  players,
}: ClubMatchRecapProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white font-medium truncate">
          {opponentName ?? t("club.opponentPending")}
        </span>
        {ourGoals != null && opponentGoals != null && (
          <span className="text-white font-mono tabular-nums">
            {ourGoals} – {opponentGoals}
          </span>
        )}
      </div>
      <ul className="divide-y divide-slate-700">
        {players.map((player) => (
          <li key={player.playerId} className="flex items-start gap-3 py-3">
            <UserAvatar userId={player.userId ?? null} name={player.name} className="w-8 h-8" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-white truncate">{player.name}</p>
                {player.isMvp && (
                  <Badge className="bg-amber-500 text-slate-900 border-0 text-[10px]">
                    <Crown className="w-3 h-3 mr-1" />
                    {t("historial.mvp")}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3 text-emerald-400" />
                  {player.goals} {t("historial.goals")}
                </span>
                <span className="flex items-center gap-1">
                  <Handshake className="w-3 h-3 text-sky-400" />
                  {player.assists} {t("historial.assists")}
                </span>
                {player.minutes != null && (
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    {player.minutes} {t("historial.minutes")}
                  </span>
                )}
                {player.peerAverage != null && (
                  <span>
                    {t("historial.meanScore")} {player.peerAverage.toFixed(1)}
                  </span>
                )}
                {player.points != null && (
                  <span className="text-emerald-400">
                    {player.points.toFixed(1)} {t("clasificacion.points")}
                  </span>
                )}
              </div>
              {player.vmBefore != null && player.vmAfter != null && (
                <p className="text-xs text-slate-400">
                  {t("historial.ratingThen")} {formatDisplayMarketValue(player.vmBefore)} → {formatDisplayMarketValue(player.vmAfter)}
                  {player.delta != null && player.delta !== 0
                    ? ` (${formatDisplayMarketValueDelta(player.delta)})`
                    : ""}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
