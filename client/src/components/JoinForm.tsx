import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { ApiError, describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { isValidInviteCode, normalizeInviteCode, parseInviteCode } from "@shared/domain/inviteCodes";

interface JoinFormProps {
  onSuccess?: () => void;
}

interface UnlinkedPlayer {
  id: number;
  name: string;
  isExternal: boolean;
}

/**
 * One invite field for both experiences: the code itself says whether it opens a League
 * (`L-…` or a legacy six-character code) or a Club (`C-…`).
 */
export default function JoinForm({ onSuccess }: JoinFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState("");
  const [alias, setAlias] = useState("");
  const [claimedName, setClaimedName] = useState("");
  const [claimPending, setClaimPending] = useState(false);

  const normalized = normalizeInviteCode(inviteCode);
  const parsed = parseInviteCode(normalized);
  const codeLooksValid = isValidInviteCode(normalized);
  const isClub = parsed?.context === "club";
  const resource = isClub ? "clubs" : "leagues";

  const { data: unlinked = [] } = useQuery<UnlinkedPlayer[]>({
    queryKey: queryKeys.unlinkedPlayers(normalized),
    queryFn: () => api.get<UnlinkedPlayer[]>(`/api/${resource}/${encodeURIComponent(normalized)}/unlinked-players`),
    enabled: codeLooksValid,
  });

  const joinMutation = useMutation({
    mutationFn: async (input: {
      inviteCode: string;
      club: boolean;
      alias?: string;
      playerId?: number;
    }) => {
      const path = input.club ? "clubs" : "leagues";
      const body = input.playerId != null ? { playerId: input.playerId } : { alias: input.alias };
      return apiRequest("POST", `/api/${path}/${input.inviteCode}/join`, body);
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.club ? t("club.joined") : t("league.joined"),
        description: variables.club
          ? t("club.joinedDescription")
          : t("league.joinedDescription"),
      });
      queryClient.invalidateQueries({
        queryKey: variables.club ? queryKeys.clubs : queryKeys.leagues,
      });
      onSuccess?.();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === "CLAIM_PENDING") {
        setClaimPending(true);
        return;
      }
      toast({
        title: t("common.error"),
        description: describeApiError(error, t) || t("league.joinError"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeLooksValid || !alias.trim()) return;
    setClaimedName(alias.trim());
    setClaimPending(false);
    joinMutation.mutate({ inviteCode: normalized, alias: alias.trim(), club: isClub });
  };

  const handleClaim = (player: UnlinkedPlayer) => {
    if (!codeLooksValid) return;
    setClaimedName(player.name);
    setClaimPending(false);
    joinMutation.mutate({ inviteCode: normalized, playerId: player.id, club: isClub });
  };

  if (claimPending) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-white font-medium">{t("claims.pendingTitle")}</p>
        <p className="text-sm text-slate-400">
          {t("claims.pendingDescription", { alias: claimedName || alias.trim() })}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setClaimPending(false)}
          className="w-full border-slate-600 text-slate-200 hover:bg-slate-700"
        >
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="inviteCode" className="text-white">
          {t("league.inviteCode")} *
        </Label>
        <Input
          id="inviteCode"
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder={t("league.inviteCodePlaceholder")}
          className="bg-slate-900 border-slate-600 text-white placeholder-slate-400 font-mono"
          required
        />
        {normalized.length > 0 && !codeLooksValid && (
          <p className="text-xs text-orange-400">{t("league.inviteCodeFormat")}</p>
        )}
        {codeLooksValid && (
          <p className="text-xs text-emerald-400">
            {isClub ? t("join.detectedClub") : t("join.detectedLeague")}
          </p>
        )}
      </div>

      {codeLooksValid && unlinked.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">{t("join.unlinkedHint")}</p>
          <ul className="divide-y divide-slate-700 rounded-md border border-slate-700">
            {unlinked.map((player) => (
              <li key={player.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-white truncate">{player.name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={joinMutation.isPending}
                  onClick={() => handleClaim(player)}
                  className="shrink-0 border-sky-500 text-sky-400 hover:bg-sky-500 hover:text-white"
                >
                  {t("join.claim")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="joinAlias" className="text-white">
          {t("alias.label")} *
        </Label>
        <Input
          id="joinAlias"
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder={t("alias.placeholder")}
          className="bg-slate-900 border-slate-600 text-slate-400 placeholder-slate-400"
          maxLength={30}
          required
        />
        <p className="text-xs text-slate-400">{t("alias.hint")}</p>
      </div>

      <Button
        type="submit"
        disabled={joinMutation.isPending || !codeLooksValid || !alias.trim()}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        {joinMutation.isPending ? t("common.joining") : t("join.submit")}
      </Button>
    </form>
  );
}
