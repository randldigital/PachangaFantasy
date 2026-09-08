import { Crown, Handshake, Coins, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface MatchRecapPlayer {
  playerId: number;
  name: string;
  team: "A" | "B" | null;
  goals: number;
  assists: number;
  points: number | null;
  mvpVotes: number;
  isMvp: boolean;
  peerAverage: number | null;
  vmBefore: number | null;
  vmAfter: number | null;
  delta: number | null;
}

interface MatchRecapPitchProps {
  teamAGoals: number | null;
  teamBGoals: number | null;
  players: MatchRecapPlayer[];
}

const FORMATIONS: Record<number, [number, number][]> = {
  1: [[20, 50]],
  2: [[16, 24], [34, 76]],
  3: [[12, 50], [34, 18], [34, 82]],
  4: [[12, 50], [24, 14], [24, 86], [36, 50]],
  5: [[11, 50], [23, 13], [23, 87], [36, 32], [36, 68]],
  6: [[11, 50], [23, 12], [23, 50], [23, 88], [36, 28], [36, 72]],
};

function slotsForCount(count: number): [number, number][] {
  if (count <= 0) {
    return [];
  }
  if (FORMATIONS[count]) {
    return FORMATIONS[count];
  }
  const slots = [...FORMATIONS[6]];
  for (let i = 6; i < count; i++) {
    const fromGoal = 32 + ((i - 6) % 2) * 4;
    const across = i % 2 === 0 ? 18 : 82;
    slots.push([Math.min(fromGoal, 38), across]);
  }
  return slots;
}

function slotsForSide(count: number, side: "A" | "B"): [number, number][] {
  const slots = slotsForCount(count);
  if (side !== "B" || count < 4) {
    return slots;
  }
  return slots.map((slot, index) => {
    const isForward = index >= count - 2;
    if (!isForward) {
      return slot;
    }
    const [fromGoal, across] = slot;
    return [fromGoal, across < 50 ? Math.max(16, across - 10) : Math.min(84, across + 10)];
  });
}

function toPosition(fromGoal: number, across: number, side: "A" | "B") {
  return {
    left: `${across}%`,
    top: `${side === "A" ? fromGoal : 100 - fromGoal}%`,
  };
}

function pointsBadgeClass(points: number | null) {
  if (points == null) {
    return "bg-slate-500 text-white";
  }
  if (points >= 12) {
    return "bg-sky-500 text-white";
  }
  if (points >= 8) {
    return "bg-emerald-500 text-white";
  }
  if (points >= 5) {
    return "bg-amber-500 text-slate-900";
  }
  if (points < 0) {
    return "bg-red-500 text-white";
  }
  return "bg-slate-500 text-white";
}

function orderForPitch(players: MatchRecapPlayer[]) {
  return [...players].sort((a, b) => (a.points ?? 0) - (b.points ?? 0) || a.name.localeCompare(b.name));
}

function vmLabel(player: MatchRecapPlayer) {
  if (player.vmBefore == null && player.vmAfter == null) {
    return null;
  }
  if (player.vmBefore != null && player.vmAfter != null && player.vmBefore !== player.vmAfter) {
    return `${player.vmBefore}→${player.vmAfter}`;
  }
  return String(player.vmAfter ?? player.vmBefore);
}

function PlayerToken({ player, side }: { player: MatchRecapPlayer; side: "A" | "B" | "none" }) {
  const { t } = useTranslation();
  const showGoals = player.goals > 0;
  const showAssists = player.assists > 0;
  const showMvp = player.isMvp;
  const market = vmLabel(player);
  const initials = player.name.substring(0, 2).toUpperCase();

  return (
    <div className="flex flex-col items-center w-16 sm:w-[4.5rem]">
      <div className="relative">
        {(showGoals || showAssists || showMvp) && (
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 z-10">
            {showGoals && (
              <span
                className="flex items-center gap-0.5 rounded-full bg-emerald-500 px-1 py-0.5 text-[10px] text-white font-bold shadow"
                title={t("historial.goals")}
              >
                <Target className="w-3 h-3" />
                {player.goals > 1 ? player.goals : null}
              </span>
            )}
            {showAssists && (
              <span
                className="flex items-center gap-0.5 rounded-full bg-sky-500 px-1 py-0.5 text-[10px] text-white font-bold shadow"
                title={t("historial.assists")}
              >
                <Handshake className="w-3 h-3" />
                {player.assists > 1 ? player.assists : null}
              </span>
            )}
            {showMvp && (
              <span
                className="flex items-center rounded-full bg-amber-400 px-1 py-0.5 shadow"
                title={t("historial.mvp")}
              >
                <Crown className="w-3 h-3 text-slate-900" />
              </span>
            )}
          </div>
        )}

        <div className="relative">
          <Avatar
            className={cn(
              "h-8 w-8 sm:h-9 sm:w-9 border-2 shadow-md",
              side === "A" ? "border-red-300" : side === "B" ? "border-sky-300" : "border-slate-400",
              showMvp && "ring-2 ring-amber-400 ring-offset-1 ring-offset-transparent",
            )}
          >
            <AvatarFallback
              className={cn(
                "text-[11px] font-bold",
                side === "A" ? "bg-red-600 text-white" : side === "B" ? "bg-sky-600 text-white" : "bg-slate-600 text-white",
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          {player.points != null && (
            <span
              className={cn(
                "absolute -right-1.5 -bottom-1 h-5 min-w-6 px-1 rounded-full text-[9px] font-bold flex items-center justify-center shadow",
                pointsBadgeClass(player.points),
              )}
              title={t("clasificacion.points")}
            >
              {player.points.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <p className="mt-1 max-w-full truncate text-[10px] sm:text-[11px] font-semibold text-white bg-black/65 rounded-full px-1.5 py-0.5 text-center leading-tight">
        {player.name}
      </p>
      <div className="flex items-center gap-1 text-[9px] text-white/90 leading-tight">
        {market && (
          <span className="flex items-center gap-0.5" title={t("historial.ratingThen")}>
            <Coins className="w-2.5 h-2.5 text-emerald-200" />
            {market}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MatchRecapPitch({ teamAGoals, teamBGoals, players }: MatchRecapPitchProps) {
  const { t } = useTranslation();
  const teamA = orderForPitch(players.filter((player) => player.team === "A"));
  const teamB = orderForPitch(players.filter((player) => player.team === "B"));
  const unassigned = players.filter((player) => player.team !== "A" && player.team !== "B");
  const slotsA = slotsForSide(teamA.length, "A");
  const slotsB = slotsForSide(teamB.length, "B");

  return (
    <div className="space-y-3 pt-3">
      <div className="relative w-full max-w-md sm:max-w-xl mx-auto h-[40rem] sm:h-[48rem] rounded-xl overflow-hidden border border-white/10 shadow-inner">
        <div
          className="absolute inset-x-0 top-0 h-1/2"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, #b42318 0px, #b42318 28px, #9b1c14 28px, #9b1c14 56px)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, #1d4ed8 0px, #1d4ed8 28px, #1e40af 28px, #1e40af 56px)",
          }}
        />

        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 56 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect x="1.2" y="1.2" width="53.6" height="97.6" fill="none" stroke="white" strokeWidth="0.45" opacity="0.55" />
          <line x1="1.2" y1="50" x2="54.8" y2="50" stroke="white" strokeWidth="0.4" opacity="0.55" />
          <circle cx="28" cy="50" r="7.2" fill="none" stroke="white" strokeWidth="0.4" opacity="0.55" />
          <circle cx="28" cy="50" r="0.7" fill="white" opacity="0.55" />
          <rect x="16" y="1.2" width="24" height="12" fill="none" stroke="white" strokeWidth="0.4" opacity="0.55" />
          <rect x="21.5" y="1.2" width="13" height="5" fill="none" stroke="white" strokeWidth="0.4" opacity="0.55" />
          <rect x="16" y="86.8" width="24" height="12" fill="none" stroke="white" strokeWidth="0.4" opacity="0.55" />
          <rect x="21.5" y="93.8" width="13" height="5" fill="none" stroke="white" strokeWidth="0.4" opacity="0.55" />
          <rect x="23.5" y="0.2" width="9" height="1" fill="white" opacity="0.45" />
          <rect x="23.5" y="98.8" width="9" height="1" fill="white" opacity="0.45" />
        </svg>

        <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-[2px] pointer-events-none">
          <span className="text-[9px] uppercase tracking-wide text-red-200 font-semibold">{t("match.teamA")}</span>
          <span className="text-sm font-black tabular-nums text-white leading-none">
            {teamAGoals ?? "–"}
            <span className="text-white/50 mx-1">–</span>
            {teamBGoals ?? "–"}
          </span>
          <span className="text-[9px] uppercase tracking-wide text-sky-200 font-semibold">{t("match.teamB")}</span>
        </div>

        <span className="absolute left-2 top-2 z-10 text-[10px] uppercase tracking-wide text-red-50 font-semibold bg-red-900/45 rounded px-1.5 py-0.5 pointer-events-none">
          {t("match.teamA")}
        </span>
        <span className="absolute left-2 bottom-2 z-10 text-[10px] uppercase tracking-wide text-sky-50 font-semibold bg-sky-900/45 rounded px-1.5 py-0.5 pointer-events-none">
          {t("match.teamB")}
        </span>

        {teamA.map((player, index) => {
          const [x, y] = slotsA[index] ?? [18, 50];
          return (
            <div
              key={player.playerId}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-[5]"
              style={toPosition(x, y, "A")}
            >
              <PlayerToken player={player} side="A" />
            </div>
          );
        })}

        {teamB.map((player, index) => {
          const [x, y] = slotsB[index] ?? [18, 50];
          return (
            <div
              key={player.playerId}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-[5]"
              style={toPosition(x, y, "B")}
            >
              <PlayerToken player={player} side="B" />
            </div>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center rounded-lg border border-slate-700 bg-slate-900/50 p-3">
          {unassigned.map((player) => (
            <PlayerToken key={player.playerId} player={player} side="none" />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] uppercase tracking-wide text-slate-400">
        <span className="flex items-center gap-1">
          <Target className="w-3 h-3 text-emerald-400" /> {t("historial.goals")}
        </span>
        <span className="flex items-center gap-1">
          <Handshake className="w-3 h-3 text-sky-400" /> {t("historial.assists")}
        </span>
        <span className="flex items-center gap-1">
          <Crown className="w-3 h-3 text-amber-400" /> {t("historial.mvp")}
        </span>
        <span className="flex items-center gap-1">
          <Coins className="w-3 h-3 text-emerald-300" /> {t("historial.ratingThen")}
        </span>
      </div>
    </div>
  );
}
