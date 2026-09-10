import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Player } from "@shared/schema";

interface ClubRosterSectionProps {
  clubId: number;
  onAddPlayer?: () => void;
}

export default function ClubRosterSection({ clubId, onAddPlayer }: ClubRosterSectionProps) {
  const { t } = useTranslation();

  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: queryKeys.clubPlayers(clubId),
    queryFn: () => api.get<Player[]>(`/api/clubs/${clubId}/players`),
  });

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-white">{t("roster.title")}</CardTitle>
        {onAddPlayer && (
          <Button
            size="sm"
            onClick={onAddPlayer}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {t("club.addPlayers")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-slate-400">{t("common.loading")}</p>
        ) : players.length === 0 ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-slate-400">{t("club.noPlayers")}</p>
            {onAddPlayer && (
              <Button onClick={onAddPlayer} className="bg-sky-600 hover:bg-sky-700 text-white">
                <UserPlus className="w-4 h-4 mr-2" />
                {t("club.addPlayers")}
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-700">
            {players.map((player) => (
              <li key={player.id} className="flex items-center gap-3 py-3">
                <UserAvatar userId={player.userId} name={player.name} className="w-8 h-8" />
                <span className="text-white flex-1">{player.name}</span>
                {(player.marketValue ?? 0) > 0 && (
                  <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                    ${player.marketValue}
                  </Badge>
                )}
                {player.isExternal && (
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    {t("roster.external")}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
