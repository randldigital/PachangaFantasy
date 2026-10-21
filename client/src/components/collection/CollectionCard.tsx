import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { COLLECTION_TIMEZONE } from "@shared/domain/collection";
import { currentSeasonKey } from "@shared/domain/season";
import { initialsOf, useAvatarUrl } from "@/components/UserAvatar";
import { apiUrl } from "@/lib/apiBase";
import { cn } from "@/lib/utils";

export type AlbumCard = {
  id: number;
  sourceKey: string;
  cardType: string;
  rarity: string;
  status: "active" | "error" | "retired";
  playerId: number | null;
  userId: number | null;
  avatarVersion: number | null;
  playerName: string | null;
  emoji: string | null;
  matchId: number | null;
  seasonKey: string | null;
  occurredAt: string;
  periodKey: string | null;
  payload: Record<string, unknown>;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  hasImage: boolean;
  ownedQuantity: number;
  points?: number | null;
  goals?: number | null;
  assists?: number | null;
  marketValue?: number | null;
  valueDelta?: number | null;
  side?: "blue" | "red" | null;
};

const RARITY_SHELL: Record<string, string> = {
  common: "border-slate-400 bg-gradient-to-b from-slate-600 via-slate-800 to-slate-950 text-slate-100",
  rare: "border-cyan-300/90 bg-gradient-to-b from-sky-900 via-slate-950 to-slate-950 text-cyan-50 shadow-[0_0_10px_rgba(34,211,238,0.18)]",
  epic: "border-violet-300 bg-gradient-to-b from-violet-800 via-indigo-950 to-slate-950 text-violet-50 shadow-[0_0_14px_rgba(167,139,250,0.28)]",
  legendary: "border-amber-300 bg-gradient-to-b from-amber-950 via-neutral-950 to-black text-amber-50 shadow-[0_0_16px_rgba(251,191,36,0.28)]",
};

const LOCKED_SHELL: Record<string, string> = {
  common: "border-slate-500",
  rare: "border-cyan-700",
  epic: "border-violet-600",
  legendary: "border-amber-600",
};

type Translator = (key: string, options?: Record<string, unknown>) => string;

type Sides = {
  leftLabel: string;
  rightLabel: string;
  leftGoals: number;
  rightGoals: number;
};

function useAuthedImage(url: string | null): string | undefined {
  const [objectUrl, setObjectUrl] = useState<string>();
  useEffect(() => {
    if (!url) {
      setObjectUrl(undefined);
      return;
    }
    let created: string | undefined;
    let cancelled = false;
    const token = localStorage.getItem("token");
    fetch(apiUrl(url), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      })
      .catch(() => setObjectUrl(undefined));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);
  return objectUrl;
}

function useWhenVisible(enabled: boolean) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled || !node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, node]);
  return { setNode, visible: enabled && visible };
}

function eventDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: COLLECTION_TIMEZONE,
  })
    .format(date)
    .replace(/\./g, "")
    .toUpperCase();
}

function monthLine(month: unknown, locale: string, compact: boolean): string {
  if (typeof month !== "string") return "";
  const [year, value] = month.split("-").map(Number);
  if (!year || !value) return month.toUpperCase();
  const name = new Intl.DateTimeFormat(locale, {
    month: compact ? "short" : "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, value - 1, 1)));
  return `${name.replace(/\./g, "")} · ${year}`.toUpperCase();
}

function matchSides(card: AlbumCard, t: Translator): Sides | null {
  const payload = card.payload;
  if (typeof payload.teamAGoals === "number" && typeof payload.teamBGoals === "number") {
    return {
      leftLabel: t("match.teamBShort"),
      rightLabel: t("match.teamAShort"),
      leftGoals: payload.teamBGoals,
      rightGoals: payload.teamAGoals,
    };
  }
  if (typeof payload.ourGoals === "number" && typeof payload.opponentGoals === "number") {
    const opponent = typeof payload.opponentName === "string" ? payload.opponentName : "";
    return {
      leftLabel: t("collection.sides.us"),
      rightLabel: opponent || t("collection.sides.opponent"),
      leftGoals: payload.ourGoals,
      rightGoals: payload.opponentGoals,
    };
  }
  return null;
}

function formatPoints(value: number | null | undefined, locale: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const rounded = Math.round(value * 10) / 10;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(rounded);
}

function scoreContext(card: AlbumCard): string {
  const sides = matchSides(card, (key) => key);
  if (!sides) return "";
  return `${sides.leftGoals}–${sides.rightGoals}`;
}

export function hattrickKicker(goals: unknown, t: Translator): string {
  return typeof goals === "number"
    ? t("collection.cards.hattrickGoals", { count: goals })
    : t("collection.badges.hattrick");
}

export type CardHero = { value: string; labelKey: string };

export function cardHero(
  card: Pick<AlbumCard, "cardType" | "points" | "marketValue" | "payload">,
  locale: string,
): CardHero | null {
  if (card.cardType === "mvp" || card.cardType === "hattrick" || card.cardType === "totm") {
    const value = formatPoints(card.points, locale);
    return value ? { value, labelKey: "collection.cards.heroPoints" } : null;
  }
  if (card.cardType === "player") {
    const value = formatPoints(card.marketValue, locale);
    return value ? { value, labelKey: "collection.cards.heroValue" } : null;
  }
  return null;
}

export function matchOutcome(card: Pick<AlbumCard, "side" | "payload">, t: Translator): string {
  const sides = matchSides({ payload: card.payload } as AlbumCard, t);
  if (!sides || (card.side !== "blue" && card.side !== "red")) return "";
  const ours = card.side === "blue" ? sides.leftGoals : sides.rightGoals;
  const theirs = card.side === "blue" ? sides.rightGoals : sides.leftGoals;
  if (ours > theirs) return t("collection.cards.victory");
  if (ours < theirs) return t("collection.cards.defeat");
  return t("collection.cards.draw");
}

function countPhrase(count: number, kind: "goal" | "assist", t: Translator): string {
  if (kind === "goal") {
    return count === 1 ? t("collection.cards.goalOne") : t("collection.cards.goalLine", { count });
  }
  return count === 1 ? t("collection.cards.assistOne") : t("collection.cards.assistLine", { count });
}

export function factDetail(card: Pick<AlbumCard, "cardType" | "goals" | "assists" | "side" | "valueDelta">, locale: string, t: Translator): string {
  const parts: string[] = [];
  if (card.cardType !== "hattrick" && typeof card.goals === "number" && card.goals > 0) {
    parts.push(card.goals === 1 ? t("collection.cards.goalOne") : t("collection.cards.goalLine", { count: card.goals }));
  }
  if (typeof card.assists === "number" && card.assists > 0) {
    parts.push(card.assists === 1 ? t("collection.cards.assistOne") : t("collection.cards.assistLine", { count: card.assists }));
  }
  if (card.side === "blue") parts.push(t("match.teamBShort"));
  if (card.side === "red") parts.push(t("match.teamAShort"));
  if (typeof card.valueDelta === "number" && Number.isFinite(card.valueDelta)) parts.push(formatSigned(card.valueDelta, locale));
  return parts.join(" · ");
}

function formatSigned(value: number, locale: string): string {
  const rounded = Math.round(value * 10) / 10;
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(rounded));
  if (rounded > 0) return `+${text}`;
  if (rounded < 0) return `-${text}`;
  return text;
}

export function cardTitle(card: AlbumCard, t: Translator): string {
  if (card.cardType === "extra") {
    return card.title || t("collection.cards.extra");
  }
  const name = card.playerName || t("collection.unknownPlayer");
  if (card.cardType === "player") return name;
  if (card.cardType === "mvp") return t("collection.cards.mvp", { name });
  if (card.cardType === "hattrick") return t("collection.cards.hattrick", { name, goals: card.payload.goals ?? 3 });
  if (card.cardType === "totm") return t("collection.cards.totm", { name, month: card.payload.month ?? "" });
  return scoreContext(card) || t("collection.cards.match");
}

const CARD_FRAME: Record<string, string> = {
  player: "/collection/frames/base.png",
  mvp: "/collection/frames/mvp.png",
  hattrick: "/collection/frames/hattrick.png",
  totm: "/collection/frames/totm.png",
  match: "/collection/frames/match.png",
};

const PORTRAIT_STYLE = { top: "2%", height: "70%", left: "12%", right: "12%" };

const HERO_CORNER: Record<string, { left: string; top: string }> = {
  player: { left: "8%", top: "6%" },
  mvp: { left: "12%", top: "11%" },
  totm: { left: "12%", top: "14%" },
  hattrick: { left: "18%", top: "14%" },
};

function CardFrame({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className="pointer-events-none absolute inset-0 z-20 h-full w-full object-cover object-center"
    />
  );
}

function Portrait({
  card,
  full,
  showImage,
}: {
  card: AlbumCard;
  full: boolean;
  showImage: boolean;
}) {
  const avatar = useAvatarUrl(showImage ? card.userId : null, card.avatarVersion ?? undefined);
  if (avatar) {
    return <img src={avatar} alt="" className="collection-portrait-fade h-full w-full object-cover object-[center_22%]" />;
  }
  return (
    <div className={cn(
      "collection-portrait-fade flex h-full items-center justify-center font-black text-slate-100",
      full ? "text-7xl" : "text-5xl",
    )}>
      {card.emoji || initialsOf(card.playerName || "?")}
    </div>
  );
}

function CardArt({
  card,
  full,
  showImage,
}: {
  card: AlbumCard;
  full: boolean;
  showImage: boolean;
}) {
  const extraImage = useAuthedImage(
    showImage && card.cardType === "extra" && card.hasImage ? `/api/collections/cards/${card.id}/image` : null,
  );
  if (card.cardType === "match") return null;
  if (card.cardType === "extra") {
    if (!extraImage) {
      return (
        <div className="absolute inset-x-[8%] top-[14%] z-[1] flex h-[52%] items-center justify-center text-4xl text-slate-400">
          {card.emoji || "✦"}
        </div>
      );
    }
    return (
      <img src={extraImage} alt="" className="collection-portrait-fade absolute inset-x-[15%] top-[8%] z-[1] h-[58%] object-cover object-[center_22%]" />
    );
  }
  return (
    <div
      className="pointer-events-none absolute z-[1] overflow-hidden"
      style={PORTRAIT_STYLE}
    >
      <Portrait card={card} full={full} showImage={showImage} />
    </div>
  );
}

function ScoreSide({
  label,
  goals,
  tone,
  win,
  full,
}: {
  label: string;
  goals: number;
  tone: "blue" | "red";
  win: boolean;
  full: boolean;
}) {
  return (
    <div className={cn(
      "flex min-w-0 flex-1 flex-col items-center",
      win && tone === "blue" && "text-sky-200 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]",
      win && tone === "red" && "text-rose-200 drop-shadow-[0_0_6px_rgba(251,113,133,0.9)]",
      !win && "text-white/75",
    )}>
      <span className={cn("max-w-full truncate font-bold uppercase tracking-[0.12em]", full ? "text-[11px]" : "text-[8px]")}>{label}</span>
      <span className={cn("font-black tabular-nums leading-none", full ? "text-5xl" : "text-3xl")}>{goals}</span>
    </div>
  );
}

function Meta({
  name,
  left,
  right,
  center,
  underLeft,
  underRight,
  full,
  rarity,
  showFacts,
}: {
  name?: string;
  left?: string;
  right?: string;
  center?: string;
  underLeft?: string;
  underRight?: string;
  full?: boolean;
  rarity?: string;
  showFacts?: boolean;
}) {
  const facts = full || showFacts;
  const line = full ? "text-[11px]" : "text-[8px]";
  return (
    <div className="relative z-10 px-0.5 text-white">
      {facts && rarity ? <div className={cn("text-center font-bold uppercase tracking-[0.18em]", full ? "text-[10px]" : "text-[7px]")}>{rarity}</div> : null}
      {name ? <div className={cn("truncate text-center font-black uppercase leading-none tracking-wide", full ? "mt-0.5 text-2xl" : "text-[13px]")}>{name}</div> : null}
      {facts && center ? <div className={cn("mt-0.5 text-center font-bold uppercase leading-tight tracking-wide", line)}>{center}</div> : null}
      {facts && (left || right) ? (
        <div className={cn("mt-0.5 flex items-baseline justify-between gap-2 font-bold uppercase leading-tight tracking-wide", line)}>
          <span className="min-w-0 flex-1 text-left">{left}</span>
          {right ? <span className="max-w-[48%] shrink-0 text-right">{right}</span> : null}
        </div>
      ) : null}
      {facts && (underLeft || underRight) ? (
        <div className={cn("flex items-baseline justify-between gap-2 font-bold uppercase leading-tight tracking-wide", full ? "text-[10px]" : "text-[7px]")}>
          <span className="min-w-0 flex-1 text-left">{underLeft}</span>
          {underRight ? <span className="max-w-[48%] shrink-0 text-right">{underRight}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function FaceCopy({
  card,
  full,
  locale,
  t,
  rarity,
  contextName,
}: {
  card: AlbumCard;
  full: boolean;
  locale: string;
  t: Translator;
  rarity?: string;
  contextName?: string;
}) {
  const name = card.playerName || t("collection.unknownPlayer");
  const season = card.seasonKey || (card.cardType === "player" ? currentSeasonKey() : null);
  const when = eventDate(card.occurredAt, locale);
  const score = scoreContext(card);
  const counts = typeof card.goals === "number" || typeof card.assists === "number"
    ? [countPhrase(card.goals ?? 0, "goal", t), countPhrase(card.assists ?? 0, "assist", t)].join(" · ")
    : "";
  const result = matchOutcome(card, t);

  if (card.cardType === "match") {
    return <Meta left={full ? t("collection.types.match") : undefined} />;
  }
  if (card.cardType === "extra") {
    return (
      <div className="relative z-10 px-0.5 pt-1 text-center text-white">
        <div className="truncate text-[11px] font-black uppercase tracking-wide">{card.title || t("collection.cards.extra")}</div>
        {card.subtitle ? <div className="truncate text-[8px] uppercase tracking-wide text-white/70">{card.subtitle}</div> : null}
        {full && card.body ? <p className="mt-1 line-clamp-3 text-left text-[10px] leading-snug text-white/65">{card.body}</p> : null}
      </div>
    );
  }
  if (card.cardType === "totm") {
    return (
      <Meta
        name={name}
        center={monthLine(card.payload.month, locale, false)}
        left={typeof card.goals === "number" ? countPhrase(card.goals, "goal", t) : ""}
        right={typeof card.assists === "number" ? countPhrase(card.assists, "assist", t) : ""}
        full={full}
        showFacts
        rarity={rarity}
      />
    );
  }
  if (card.cardType === "player") {
    return <Meta name={name} left={contextName} right={season ?? undefined} full={full} showFacts rarity={rarity} />;
  }
  return (
    <Meta
      name={name}
      left={when}
      underLeft={counts}
      right={score}
      underRight={result}
      full={full}
      showFacts
      rarity={rarity}
    />
  );
}

function Pitch() {
  return (
    <svg viewBox="0 0 100 150" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="6" y="6" width="88" height="138" fill="rgba(21,128,61,0.72)" stroke="rgba(255,255,255,0.82)" strokeWidth="1.4" />
      <line x1="6" y1="75" x2="94" y2="75" stroke="rgba(255,255,255,0.82)" strokeWidth="1.1" />
      <circle cx="50" cy="75" r="12" fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="1.1" />
      <rect x="26" y="6" width="48" height="24" fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="1.1" />
      <rect x="26" y="120" width="48" height="24" fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="1.1" />
    </svg>
  );
}

function MatchBoard({ card, full, locale, t, rarity }: { card: AlbumCard; full: boolean; locale: string; t: Translator; rarity?: string }) {
  const sides = matchSides(card, t);
  const when = eventDate(card.occurredAt, locale);
  const winner = !sides || sides.leftGoals === sides.rightGoals ? "draw" : sides.leftGoals > sides.rightGoals ? "blue" : "red";
  return (
    <div className="absolute inset-x-[14%] top-[16%] bottom-[14%] z-10 flex items-center justify-center text-center text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
      <div className="pointer-events-none absolute inset-0 origin-center scale-110">
        <Pitch />
      </div>
      <div className="relative w-full">
      {rarity ? <div className={cn("font-bold uppercase tracking-[0.16em]", full ? "text-xs" : "text-[9px]")}>{rarity}</div> : null}
      {when ? <div className={cn("font-bold uppercase tracking-[0.14em]", full ? "text-lg" : "text-xs")}>{when}</div> : null}
      {sides ? (
        <div className="mt-1 flex w-full items-end justify-center">
          <ScoreSide label={sides.leftLabel} goals={sides.leftGoals} tone="blue" win={winner === "blue"} full={full} />
          <span className={cn("px-1 pb-1 text-white", full ? "text-3xl" : "text-base")}>—</span>
          <ScoreSide label={sides.rightLabel} goals={sides.rightGoals} tone="red" win={winner === "red"} full={full} />
        </div>
      ) : null}
      {card.seasonKey ? <div className={cn("uppercase tracking-[0.14em]", full ? "text-sm" : "text-[10px]")}>{card.seasonKey}</div> : null}
      </div>
    </div>
  );
}

export default function CollectionCard({
  card,
  mode,
  onOpen,
  contextName,
}: {
  card: AlbumCard;
  mode: "placeholder" | "thumbnail" | "full";
  onOpen?: () => void;
  contextName?: string;
}) {
  const { t, i18n } = useTranslation();
  const locked = card.ownedQuantity <= 0 && mode !== "full";
  const full = mode === "full";
  const { setNode, visible } = useWhenVisible(!locked && !full);
  const showImage = full || visible;
  const rarity = t(`collection.rarity.${card.rarity}`, { defaultValue: card.rarity });
  const typeLabel = t(`collection.types.${card.cardType}`, { defaultValue: card.cardType });
  const badge = t(`collection.badges.${card.cardType}`, { defaultValue: typeLabel });
  const shell = RARITY_SHELL[card.rarity] ?? RARITY_SHELL.common;
  const frameSrc = (full || visible) ? CARD_FRAME[card.cardType] : undefined;
  const framed = Boolean(CARD_FRAME[card.cardType]);
  const hero = framed && card.cardType !== "match" && card.cardType !== "extra" ? cardHero(card, i18n.language) : null;

  if (locked) {
    return (
      <div
        role="group"
        aria-disabled="true"
        aria-label={t("collection.lockedLabel", { type: typeLabel, rarity })}
        className={cn(
          "flex aspect-[5/7] w-full cursor-default select-none flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-slate-950 px-3 text-center",
          LOCKED_SHELL[card.rarity] ?? LOCKED_SHELL.common,
        )}
      >
        <div className="text-4xl font-black text-slate-500">?</div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{typeLabel}</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{rarity}</div>
        <div className="mt-1 rounded-full border border-slate-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">
          {t("collection.locked")}
        </div>
      </div>
    );
  }

  const face = (
    <>
      {framed ? null : <div className="pointer-events-none absolute inset-1 rounded-[14px] border border-white/10" />}
      {!framed && card.rarity === "epic" ? (
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_42%,rgba(196,181,253,0.14)_42%,rgba(196,181,253,0.14)_48%,transparent_48%)]" />
      ) : null}
      {!framed && card.rarity === "rare" ? (
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_42%)]" />
      ) : null}
      {!framed && full && card.rarity === "legendary" ? <span className="collection-shimmer pointer-events-none absolute inset-0" /> : null}
      {!framed && full && card.rarity === "legendary" ? (
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(251,191,36,0.22),transparent_46%)]" />
      ) : null}
      {framed ? null : (
        <div className="relative z-30 flex h-4 items-center justify-between gap-1">
          <span className="truncate text-[9px] font-bold uppercase leading-none tracking-[0.14em] [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">{rarity}</span>
          <span className="inline-flex h-4 max-w-[62%] items-center rounded-full bg-black/50 px-1.5 text-[9px] font-bold uppercase leading-none tracking-wide">
            <span className="truncate">{badge}</span>
          </span>
        </div>
      )}
      <CardArt card={card} full={full} showImage={showImage} />
      {hero ? (
        <div
          className="pointer-events-none absolute z-10 text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]"
          style={HERO_CORNER[card.cardType] ?? { left: "8%", top: "6%" }}
        >
          <div className={cn("font-black tabular-nums leading-none", full ? "text-3xl" : "text-lg")}>{hero.value}</div>
          <div className={cn("font-bold uppercase tracking-[0.14em]", full ? "text-[10px]" : "text-[7px]")}>{t(hero.labelKey)}</div>
        </div>
      ) : null}
      {card.cardType === "match" ? (
        <MatchBoard card={card} full={full} locale={i18n.language} t={t} rarity={framed ? rarity : undefined} />
      ) : (
        <div className={cn(
          "absolute z-10",
          framed ? "inset-x-[16%] bottom-[12%] [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]" : "inset-x-2 bottom-[7%] z-20 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]",
        )}>
          <FaceCopy card={card} full={full} locale={i18n.language} t={t} rarity={framed ? rarity : undefined} contextName={contextName} />
        </div>
      )}
      {frameSrc ? <CardFrame src={frameSrc} /> : null}
      {card.ownedQuantity > 1 ? (
        <span className={cn(
          "absolute z-30 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold leading-none text-emerald-300",
          framed ? "right-[16%] top-[22%]" : "right-2 top-6",
        )}>
          x{card.ownedQuantity}
        </span>
      ) : null}
      {card.status === "error" ? (
        <span className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
          <span className={cn(
            "w-[145%] -rotate-12 border-y-2 border-red-100/80 bg-red-700/80 text-center font-black tracking-[0.4em] text-white shadow-[0_0_0_1px_rgba(127,29,29,0.6)]",
            full ? "py-1.5 text-lg" : "py-0.5 text-[10px]",
          )}>
            ERROR
          </span>
        </span>
      ) : null}
      {card.status === "retired" ? (
        <span className={cn(
          "absolute z-30 bg-slate-200/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-slate-900",
          framed ? "left-[16%] top-[22%]" : "left-2 top-6",
        )}>
          {t("collection.retired")}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "relative flex aspect-[5/7] w-full flex-col overflow-hidden text-left",
    framed ? "bg-transparent text-white" : "rounded-2xl border-[3px] p-2",
    framed ? null : shell,
    full && "collection-card-reveal",
    !full && "cursor-pointer transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300",
  );
  if (full) {
    return (
      <div ref={setNode} className={className}>
        {face}
      </div>
    );
  }

  return (
    <button
      ref={setNode}
      type="button"
      className={className}
      style={{ contentVisibility: "auto" }}
      onClick={() => {
        if (card.ownedQuantity > 0) onOpen?.();
      }}
    >
      {face}
    </button>
  );
}
