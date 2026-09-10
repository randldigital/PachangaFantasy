import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Player } from "@shared/schema";

interface ClubRosterSectionProps {
  clubId: number;
}

export default function ClubRosterSection({ clubId }: ClubRosterSectionProps) {
  const { t } = useTranslation();

  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: queryKeys.clubPlayers(clubId),
    queryFn: () => api.get<Player[]>(`/api/clubs/${clubId}/players`),
  });

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">{t("roster.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-slate-400">{t("common.loading")}</p>
        ) : players.length === 0 ? (
          <p className="text-slate-400">{t("club.noPlayers")}</p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {players.map((player) => (
              <li key={player.id} className="flex items-center gap-3 py-3">
                <UserAvatar userId={player.userId} name={player.name} className="w-8 h-8" />
                <span className="text-white flex-1">{player.name}</span>
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
