import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { describeApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { UserPlus, Users } from "lucide-react";

const playerEmojis = ["⚽", "🏃", "🛡️", "🎯", "🥅", "⚡", "🔥", "💎", "👑", "🌟"];

const addPlayerSchema = z.object({
  name: z.string().min(1).max(30),
  emoji: z.string().default("⚽"),
  isExternal: z.boolean().default(true),
});

type AddPlayerFormData = z.infer<typeof addPlayerSchema>;

interface AddPlayerFormProps {
  leagueId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AddPlayerForm({ leagueId, isOpen, onClose }: AddPlayerFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const numericLeagueId = parseInt(leagueId, 10);

  const form = useForm<AddPlayerFormData>({
    resolver: zodResolver(addPlayerSchema),
    defaultValues: {
      name: "",
      emoji: "⚽",
      isExternal: true,
    },
  });

  const addPlayerMutation = useMutation({
    mutationFn: async (data: AddPlayerFormData) => {
      return api.post<{ name: string }>(`/api/players/${numericLeagueId}`, {
        name: data.name,
        emoji: data.emoji,
        isExternal: data.isExternal,
      });
    },
    onSuccess: (player) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leaguePlayers(numericLeagueId) });
      toast({
        title: t("league.playerAdded"),
        description: t("league.playerAddedDescription", { name: player.name }),
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: t("league.addPlayerError"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <UserPlus className="h-5 w-5 text-blue-400" />
            {t("league.addExternalPlayer")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => addPlayerMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">{t("league.playerName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("league.playerName")}
                      {...field}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">{t("league.playerEmoji")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {playerEmojis.map((emoji) => (
                        <SelectItem key={emoji} value={emoji} className="text-white hover:bg-slate-600">
                          <span className="text-xl mr-2">{emoji}</span>
                          {emoji}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
              <div className="flex items-center gap-2 text-slate-300">
                <Users className="h-4 w-4" />
                <span className="text-sm">{t("league.addExternalHint")}</span>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={addPlayerMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {addPlayerMutation.isPending ? t("common.adding") : t("league.addPlayer")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
