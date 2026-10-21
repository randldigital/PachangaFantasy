import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { League } from "@shared/schema";

const STORAGE_KEY = "pachanga.collectionIntro";
const POSTER_SRC = "/collection/intro.jpg";

type LeagueRow = League & { hasCollection?: boolean };

export function introSeenKey(userId: number, leagueId: number): string {
  return `${userId}:${leagueId}`;
}

export function readIntroSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function firstUnseenCollection<T extends { id: number; hasCollection?: boolean }>(
  leagues: T[],
  seen: ReadonlySet<string>,
  userId: number,
): T | null {
  return leagues.find((league) => league.hasCollection && !seen.has(introSeenKey(userId, league.id))) ?? null;
}

function rememberIntro(userId: number, leagueId: number): Set<string> {
  const seen = readIntroSeen();
  seen.add(introSeenKey(userId, leagueId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  return seen;
}

export default function CollectionIntro() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [seen, setSeen] = useState<Set<string>>(() => readIntroSeen());
  const { data: leagues = [] } = useQuery<LeagueRow[]>({
    queryKey: queryKeys.leagues,
    queryFn: () => api.get<LeagueRow[]>("/api/leagues"),
    enabled: Boolean(user),
  });

  const target = user ? firstUnseenCollection(leagues, seen, user.id) : null;
  const onCollection = target != null && location.startsWith(`/league/${target.id}/collection`);
  const open = target != null && !onCollection;

  const dismiss = () => {
    if (!user || !target) return;
    setSeen(rememberIntro(user.id, target.id));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto border-slate-700 bg-slate-950 p-3 text-white sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("collection.introTitle")}</DialogTitle>
        </DialogHeader>
        <img src={POSTER_SRC} alt={t("collection.introAlt")} className="max-h-[70dvh] w-full rounded-lg object-contain" />
        <Button
          type="button"
          className="w-full bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
          onClick={() => {
            if (!target) return;
            dismiss();
            setLocation(`/league/${target.id}/collection`);
          }}
        >
          {t("collection.introGo")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
