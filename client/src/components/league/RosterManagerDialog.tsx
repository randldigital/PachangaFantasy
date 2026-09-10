import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import UserAvatar from "@/components/UserAvatar";
import type { Player } from "@shared/schema";

interface ClaimRequest {
  id: number;
  playerId: number;
  playerName: string;
  userId: number;
  username: string;
}

interface RosterManagerDialogProps {
  leagueId: number;
  players: Player[];
  isOpen: boolean;
  onClose: () => void;
}

export default function RosterManagerDialog({
  leagueId,
  players,
  isOpen,
  onClose,
}: RosterManagerDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftAlias, setDraftAlias] = useState("");

  const { data: claims = [] } = useQuery<ClaimRequest[]>({
    queryKey: queryKeys.leagueClaimRequests(leagueId),
    queryFn: () => api.get<ClaimRequest[]>(`/api/leagues/${leagueId}/claim-requests`),
    enabled: isOpen,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.leaguePlayers(leagueId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.leagueClaimRequests(leagueId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.league(leagueId) });
  };

  const renameMutation = useMutation({
    mutationFn: async (input: { playerId: number; alias: string }) =>
      apiRequest("PATCH", `/api/players/${input.playerId}/alias`, { alias: input.alias }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast({ title: t("alias.renamed") });
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (input: { requestId: number; decision: "accept" | "reject" }) =>
      apiRequest("POST", `/api/claim-requests/${input.requestId}/resolve`, {
        decision: input.decision,
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: t("claims.resolved") });
    },
    onError: (error: unknown) => {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{t("roster.title")}</DialogTitle>
        </DialogHeader>

        {claims.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">{t("claims.title")}</h4>
            <p className="text-xs text-slate-400">{t("claims.adminHint")}</p>
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"
              >
                <div className="min-w-0">
                  <div className="text-white text-sm truncate">{claim.playerName}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {t("claims.requestedBy", { username: claim.username })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={resolveMutation.isPending}
                    onClick={() =>
                      resolveMutation.mutate({ requestId: claim.id, decision: "accept" })
                    }
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {t("claims.accept")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolveMutation.isPending}
                    onClick={() =>
                      resolveMutation.mutate({ requestId: claim.id, decision: "reject" })
                    }
                    className="border-slate-600 text-slate-200 hover:bg-slate-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {t("claims.reject")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">{t("roster.players")}</h4>
          {players.map((player) => (
            <div
              key={player.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar userId={player.userId} name={player.name} />
                {editingId === player.id ? (
                  <Input
                    autoFocus
                    value={draftAlias}
                    maxLength={30}
                    onChange={(event) => setDraftAlias(event.target.value)}
                    className="h-8 bg-slate-900 border-slate-600 text-white"
                  />
                ) : (
                  <div className="min-w-0">
                    <div className="text-white text-sm truncate">{player.name}</div>
                    {player.isExternal && (
                      <Badge variant="secondary" className="bg-slate-700 text-slate-200 text-[10px]">
                        {t("roster.external")}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {editingId === player.id ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={renameMutation.isPending || !draftAlias.trim()}
                    onClick={() =>
                      renameMutation.mutate({ playerId: player.id, alias: draftAlias.trim() })
                    }
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {t("common.save")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                    className="border-slate-600 text-slate-200 hover:bg-slate-700"
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(player.id);
                    setDraftAlias(player.name);
                  }}
                  className="text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  {t("roster.rename")}
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
