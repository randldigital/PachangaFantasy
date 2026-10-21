import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ApiError, describeApiError } from "@/lib/apiError";
import { apiUrl } from "@/lib/apiBase";
import { queryKeys } from "@/lib/queryKeys";
import CollectionCard, { cardTitle, type AlbumCard } from "@/components/collection/CollectionCard";
import { groupAlbum, sectionTotals } from "@/components/collection/albumSections";
import type { Club, League } from "@shared/schema";

type Kind = "league" | "club";

type AlbumProgress = {
  owned: number;
  existing: number;
  byType: { cardType: string; owned: number; existing: number }[];
};

type AlbumResponse = {
  collection: { id: number; createdBy: number; leagueId: number | null; clubId: number | null } | null;
  cards: AlbumCard[];
  nextCursor: string | null;
  pack: { nextPackAt: string | null; ready: boolean } | null;
  progress?: AlbumProgress | null;
};

export default function CollectionPage({ kind }: { kind: Kind }) {
  const { id } = useParams<{ id: string }>();
  const orgId = Number(id);
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cards, setCards] = useState<AlbumCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [rarity, setRarity] = useState("");
  const [status, setStatus] = useState("");
  const [owned, setOwned] = useState("");
  const [selected, setSelected] = useState<AlbumCard | null>(null);
  const [revealed, setRevealed] = useState<AlbumCard[] | null>(null);
  const [opening, setOpening] = useState(false);
  const [creating, setCreating] = useState(false);

  const filterQuery = new URLSearchParams();
  if (type) filterQuery.set("type", type);
  if (rarity) filterQuery.set("rarity", rarity);
  if (status) filterQuery.set("status", status);
  if (owned) filterQuery.set("owned", owned);
  const query = filterQuery.toString();

  const orgQuery = useQuery<League | Club>({
    queryKey: kind === "league" ? queryKeys.league(orgId) : queryKeys.club(orgId),
    queryFn: () => api.get(kind === "league" ? `/api/leagues/${orgId}` : `/api/clubs/${orgId}`),
  });

  const albumQuery = useQuery<AlbumResponse>({
    queryKey: queryKeys.collection(kind, orgId, query),
    queryFn: () => api.get<AlbumResponse>(`/api/${kind}s/${orgId}/collection${query ? `?${query}` : ""}`),
  });

  const album = albumQuery.data;
  useEffect(() => {
    if (!album) return;
    setCards(album.cards);
    setNextCursor(album.nextCursor);
  }, [album]);
  const isAdmin = Boolean(user && orgQuery.data && user.id === orgQuery.data.createdBy);
  const back = kind === "league" ? `/league/${orgId}` : `/club/${orgId}`;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: [`/api/${kind}s/${orgId}/collection`] });
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    const params = new URLSearchParams(query);
    params.set("cursor", nextCursor);
    const page = await api.get<AlbumResponse>(`/api/${kind}s/${orgId}/collection?${params.toString()}`);
    setCards((current) => [...current, ...page.cards]);
    setNextCursor(page.nextCursor);
  };

  const create = async () => {
    setCreating(true);
    try {
      await api.post(`/api/${kind}s/${orgId}/collection`);
      await refresh();
    } catch (error) {
      toast({ title: t("collection.createError"), description: describeApiError(error, t), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const openPack = async () => {
    setOpening(true);
    try {
      const result = await api.post<{ cards: AlbumCard[]; nextPackAt: string }>(`/api/${kind}s/${orgId}/collection/packs/open`);
      setRevealed(result.cards);
      await refresh();
    } catch (error) {
      const description = error instanceof ApiError && error.code === "PACK_COOLDOWN"
        ? t("collection.packCooldown")
        : describeApiError(error, t);
      toast({ title: t("collection.packError"), description, variant: "destructive" });
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={back}>
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.back")}
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{t("collection.title")}</h1>
            {album?.progress ? (
              <p className="text-sm tabular-nums text-slate-300">
                {t("collection.progress", { owned: album.progress.owned, existing: album.progress.existing })}
              </p>
            ) : null}
          </div>
        </div>

        {album?.collection == null && !albumQuery.isLoading ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-slate-300">
            <p>{isAdmin ? t("collection.missingAdmin") : t("collection.missingMember")}</p>
            {isAdmin ? (
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" disabled={creating} onClick={create}>
                {t("collection.create")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {album?.collection ? (
          <>
            <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{t("collection.packTitle")}</h2>
                  <p className="text-sm text-slate-400">
                    {album.pack?.ready
                      ? t("collection.packReady")
                      : t("collection.packWait", { time: album.pack?.nextPackAt ? new Date(album.pack.nextPackAt).toLocaleString() : "" })}
                  </p>
                </div>
                <Button disabled={opening || !album.pack?.ready} onClick={openPack} className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                  {t("collection.openPack")}
                </Button>
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              <Filter value={type} onChange={setType} options={["", "player", "match", "mvp", "hattrick", "totm", "extra"]} label={(value) => value ? t(`collection.types.${value}`) : t("collection.filters.type")} />
              <Filter value={rarity} onChange={setRarity} options={["", "common", "rare", "epic", "legendary"]} label={(value) => value ? t(`collection.rarity.${value}`) : t("collection.filters.rarity")} />
              <Filter value={status} onChange={setStatus} options={["", "active", "error", "retired"]} label={(value) => value ? t(`collection.status.${value}`) : t("collection.filters.status")} />
              <Filter value={owned} onChange={setOwned} options={["", "1", "0"]} label={(value) => value === "1" ? t("collection.filters.owned") : value === "0" ? t("collection.filters.unowned") : t("collection.filters.ownership")} />
            </div>

            <div className="space-y-10">
              {groupAlbum(cards).map((section) => {
                const totals = sectionTotals(album.progress?.byType ?? [], section.id);
                const existing = totals.existing || section.cards.length;
                const owned = totals.existing > 0
                  ? totals.owned
                  : section.cards.filter((card) => card.ownedQuantity > 0).length;
                const knownSection = ["players", "matches", "awards", "performances", "extras"].includes(section.id);
                const heading = knownSection
                  ? t(`collection.sections.${section.id}.title`)
                  : t(`collection.types.${section.cards[0]?.cardType}`, { defaultValue: section.cards[0]?.cardType ?? section.id });
                const subtitle = knownSection ? t(`collection.sections.${section.id}.subtitle`) : "";
                return (
                  <section key={section.id}>
                    <div className="mb-3 flex items-end justify-between gap-3 border-b border-white/10 pb-2">
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white">{heading}</h2>
                        {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
                      </div>
                      <p className="text-sm tabular-nums text-slate-300">{t("collection.sectionProgress", { owned, existing })}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {section.cards.map((card) => {
                        const ownedCard = card.ownedQuantity > 0;
                        return (
                          <CollectionCard
                            key={`${card.id}-${card.ownedQuantity}-${card.status}`}
                            card={card}
                            mode={ownedCard ? "thumbnail" : "placeholder"}
                            onOpen={ownedCard ? () => setSelected(card) : undefined}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            {nextCursor ? (
              <Button variant="outline" className="border-slate-600 text-slate-200" onClick={loadMore}>
                {t("collection.more")}
              </Button>
            ) : null}

            {isAdmin ? <ExtraForm kind={kind} orgId={orgId} onCreated={refresh} /> : null}
          </>
        ) : null}
      </div>

      <Dialog open={selected != null && (selected?.ownedQuantity ?? 0) > 0} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="border-transparent bg-transparent px-3 pb-3 pt-10 text-white shadow-none sm:max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>{selected ? cardTitle(selected, t) : t("collection.title")}</DialogTitle>
          </DialogHeader>
          {selected && selected.ownedQuantity > 0 ? (
            <div className="mx-auto w-full max-w-[18rem]">
              <CollectionCard card={selected} mode="full" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={revealed != null} onOpenChange={(open) => { if (!open) setRevealed(null); }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto border-transparent bg-slate-950/75 p-4 text-white shadow-none sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              {t("collection.packReveal")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2">
            {revealed?.map((card, index) => (
              <div key={`${card.id}-${index}`} className="w-full max-w-[16rem]">
                <CollectionCard card={card} mode="full" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Filter({
  value,
  options,
  label,
  onChange,
}: {
  value: string;
  options: string[];
  label: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-200"
    >
      {options.map((option) => (
        <option key={option || "all"} value={option}>{label(option)}</option>
      ))}
    </select>
  );
}

function ExtraForm({ kind, orgId, onCreated }: { kind: Kind; orgId: number; onCreated: () => Promise<void> }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [rarity, setRarity] = useState("common");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!file) {
      toast({ title: t("collection.extraImageRequired"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.set("title", title);
      form.set("subtitle", subtitle);
      form.set("body", body);
      form.set("rarity", rarity);
      form.set("image", file);
      const token = localStorage.getItem("token");
      const response = await fetch(apiUrl(`/api/${kind}s/${orgId}/collection/extras`), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setTitle("");
      setSubtitle("");
      setBody("");
      setFile(null);
      await onCreated();
    } catch (error) {
      toast({ title: t("collection.extraError"), description: describeApiError(error, t), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="text-lg font-semibold text-white">{t("collection.extraTitle")}</h2>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("collection.extraFields.title")} className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />
      <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder={t("collection.extraFields.subtitle")} className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />
      <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("collection.extraFields.body")} className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />
      <select value={rarity} onChange={(event) => setRarity(event.target.value)} className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-white">
        {["common", "rare", "epic", "legendary"].map((option) => (
          <option key={option} value={option}>{t(`collection.rarity.${option}`)}</option>
        ))}
      </select>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block text-sm text-slate-300" />
      <Button disabled={saving || title.trim().length === 0} onClick={submit} className="bg-emerald-600 hover:bg-emerald-700">
        {t("collection.extraCreate")}
      </Button>
    </section>
  );
}
