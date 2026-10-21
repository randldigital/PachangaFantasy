import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { currentSeasonKey } from "@shared/domain/season";
import { BRAND_LOGO_SRC } from "@/components/BrandMark";
import CollectionCard, { type AlbumCard } from "@/components/collection/CollectionCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SlotPhase = "down" | "tease" | "revealed";

const TEASE_MS = 680;
const LEGENDARY_TEASE_MS = 900;
const REDUCED_TEASE_MS = 160;
const OPENING_MS = 420;
const REDUCED_OPENING_MS = 140;

export function packCopyStatus(
  cards: { id: number; ownedQuantity: number }[],
  index: number,
): { fresh: boolean; quantity: number } {
  const card = cards[index];
  if (!card) return { fresh: true, quantity: 1 };
  const later = cards.slice(index + 1).filter((item) => item.id === card.id).length;
  const quantity = Math.max(1, card.ownedQuantity - later);
  return { fresh: quantity <= 1, quantity };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function teaseMs(rarity: string, reduced: boolean): number {
  if (reduced) return REDUCED_TEASE_MS;
  return rarity === "legendary" ? LEGENDARY_TEASE_MS : TEASE_MS;
}

function CardBack({ contextName, season }: { contextName?: string; season: string }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-cyan-300/35 bg-slate-950 px-3 text-center text-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
      <div className="pointer-events-none absolute inset-3 rounded-xl border border-white/10" />
      <img src={BRAND_LOGO_SRC} alt="" className="relative z-10 h-[38%] w-auto max-w-[78%] object-contain" />
      <p className="relative z-10 text-[10px] font-black uppercase tracking-[0.22em] text-slate-100">Pachanga Fantasy</p>
      {contextName ? (
        <p className="relative z-10 line-clamp-2 max-w-full text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-cyan-100">{contextName}</p>
      ) : null}
      <p className="relative z-10 text-[11px] font-semibold tracking-[0.16em] text-slate-300">{season}</p>
    </div>
  );
}

function RevealSlot({
  card,
  phase,
  contextName,
  season,
  fresh,
  quantity,
  onReveal,
}: {
  card: AlbumCard;
  phase: SlotPhase;
  contextName?: string;
  season: string;
  fresh: boolean;
  quantity: number;
  onReveal: () => void;
}) {
  const { t } = useTranslation();
  const revealed = phase === "revealed";
  const faceDown = phase === "down";
  return (
    <div className={cn("pack-slot w-full max-w-[18rem]", !faceDown && `rarity-${card.rarity}`, phase === "tease" && "is-teasing", revealed && "is-revealed")}>
      <div
        className={cn("pack-flip w-full", faceDown && "cursor-pointer")}
        role={faceDown ? "button" : "group"}
        tabIndex={faceDown ? 0 : undefined}
        aria-label={faceDown ? t("collection.packRevealCard") : undefined}
        onClick={faceDown ? onReveal : undefined}
        onKeyDown={faceDown ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onReveal();
          }
        } : undefined}
      >
        <div className="pack-flip-inner">
          <div className="pack-flip-face pack-flip-back">
            <CardBack contextName={contextName} season={season} />
          </div>
          {phase !== "down" ? (
            <div className="pack-flip-face pack-flip-front" aria-hidden={!revealed}>
              <CollectionCard card={card} mode="full" contextName={contextName} />
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-2 min-h-[1.1rem] text-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
        {revealed
          ? fresh
            ? t("collection.packNew")
            : t("collection.packDuplicate", { count: quantity })
          : phase === "down"
            ? t("collection.packRevealCard")
            : ""}
      </p>
    </div>
  );
}

export default function PackReveal({
  cards,
  contextName,
  onClose,
}: {
  cards: AlbumCard[];
  contextName?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [opening, setOpening] = useState(true);
  const [phases, setPhases] = useState<SlotPhase[]>(() => cards.map(() => "down"));
  const [reduced, setReduced] = useState(false);
  const alive = useRef(true);
  const season = currentSeasonKey();
  const done = phases.length > 0 && phases.every((phase) => phase === "revealed");

  useEffect(() => {
    alive.current = true;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    const openTimer = window.setTimeout(() => setOpening(false), media.matches ? REDUCED_OPENING_MS : OPENING_MS);
    return () => {
      alive.current = false;
      media.removeEventListener("change", apply);
      window.clearTimeout(openTimer);
    };
  }, []);

  const reveal = (index: number) => {
    if (opening || phases[index] !== "down") return;
    if (phases.some((phase) => phase === "tease")) return;
    setPhases((current) => current.map((phase, slot) => (slot === index ? "tease" : phase)));
    window.setTimeout(() => {
      if (!alive.current) return;
      setPhases((current) => current.map((phase, slot) => (slot === index ? "revealed" : phase)));
    }, teaseMs(cards[index]?.rarity ?? "common", prefersReducedMotion()));
  };

  return (
    <div className={cn("pack-stage", opening && "is-opening")}>
      <h2 className="px-8 text-center text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
        {opening ? t("collection.packOpening") : done ? t("collection.packDone") : t("collection.packGot")}
      </h2>
      {opening ? (
        <div className="mx-auto mt-8 h-16 w-16 rounded-full border border-cyan-300/40 shadow-[0_0_24px_rgba(34,211,238,0.25)]" />
      ) : (
        <div className="mt-4 grid grid-cols-2 justify-items-center gap-3">
          {cards.map((card, index) => {
            const copy = packCopyStatus(cards, index);
            return (
              <RevealSlot
                key={`${card.id}-${index}`}
                card={card}
                phase={phases[index] ?? "down"}
                contextName={contextName}
                season={season}
                fresh={copy.fresh}
                quantity={copy.quantity}
                onReveal={() => reveal(index)}
              />
            );
          })}
        </div>
      )}
      {done ? (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="outline" className="border-slate-500 text-slate-100" onClick={onClose}>
            {t("collection.packContinue")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
