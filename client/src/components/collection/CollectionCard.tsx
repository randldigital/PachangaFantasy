import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { COLLECTION_TIMEZONE } from "@shared/domain/collection";
import { currentSeasonKey } from "@shared/domain/season";
import { initialsOf, useAvatarUrl } from "@/components/UserAvatar";
import { boxStyle, extraFrameTint, FRAME_LAYOUT, type FrameSafeArea, type HeroBox, type SafeBox } from "@/components/collection/frameLayout";
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
  return `${name.replace(/\./g, "")}\u00a0\u00a0\u00a0·\u00a0\u00a0\u00a0${year}`.toUpperCase();
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

function heroEm(value: string): number {
  let em = 0;
  for (const ch of value) em += ch === "," || ch === "." ? 0.4 : 0.7;
  return Math.max(em, 0.7);
}

/**
 * One size for every value in a shield, a little larger than the digits' minimum.
 * "13" and "15,5" match. The size fits "00,0"; a longer number still shrinks.
 */
export function heroTextSize(value: string, box: HeroBox): { value: string; label: string } {
  const width = Number.parseFloat(box.width) / 100;
  const em = Math.max(heroEm(value), heroEm("00,0"));
  const fitted = (width * 1.06) / em;
  const cap = Math.min(width * 0.68, 0.09);
  const valueCqw = Math.min(fitted, cap) * 100;
  return {
    value: `${valueCqw.toFixed(2)}cqw`,
    label: `${(valueCqw * 0.38).toFixed(2)}cqw`,
  };
}

function markAnchor(layout: FrameSafeArea | undefined, side: "left" | "right"): { top: string; left?: string; right?: string } {
  const box = layout && layout.portrait.height !== "0%" ? layout.portrait : layout?.center;
  if (!box) {
    return side === "right" ? { top: "1.5rem", right: "0.5rem" } : { top: "1.5rem", left: "0.5rem" };
  }
  return side === "right"
    ? { top: `calc(${box.top} + 2%)`, right: `calc(${box.right} + 2%)` }
    : { top: `calc(${box.top} + 2%)`, left: `calc(${box.left} + 2%)` };
}

/** Local testing only. Production builds keep each player's own photo. */
const TEST_PORTRAIT_USER_ID = import.meta.env.DEV ? 12 : null;

function CardFrame({ src, tint }: { src: string; tint?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      style={tint ? { filter: tint } : undefined}
      className="pointer-events-none absolute inset-0 z-20 h-full w-full object-cover object-center"
    />
  );
}

function SafeArea({ box, className, children }: { box: SafeBox; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-30 overflow-hidden text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]",
        className,
      )}
      style={boxStyle(box)}
    >
      {children}
    </div>
  );
}

function FactLine({ left, right, className }: { left?: string; right?: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-baseline justify-between gap-1", className)}>
      <span className="min-w-0 flex-1 truncate text-left">{left}</span>
      {right ? <span className="min-w-0 max-w-[48%] truncate text-right">{right}</span> : null}
    </div>
  );
}

function Portrait({
  card,
  showImage,
  fade = true,
  position = "object-[center_22%]",
}: {
  card: AlbumCard;
  showImage: boolean;
  fade?: boolean;
  position?: string;
}) {
  const portraitUserId = showImage ? (TEST_PORTRAIT_USER_ID ?? card.userId) : null;
  const avatar = useAvatarUrl(portraitUserId, TEST_PORTRAIT_USER_ID != null ? undefined : card.avatarVersion ?? undefined);
  if (avatar) {
    return <img src={avatar} alt="" className={cn(fade && "collection-portrait-fade", "object-cover", position)} />;
  }
  return (
    <div className={cn(
      fade && "collection-portrait-fade",
      "flex h-full w-full items-center justify-center overflow-hidden font-black leading-none text-slate-100 text-[22cqw]",
    )}>
      {card.emoji || initialsOf(card.playerName || "?")}
    </div>
  );
}

function CardArt({
  card,
  showImage,
  previewSrc,
}: {
  card: AlbumCard;
  showImage: boolean;
  previewSrc?: string;
}) {
  const area = FRAME_LAYOUT[card.cardType];
  if (!area || card.cardType === "match") return null;
  const extraImage = useAuthedImage(
    showImage && card.cardType === "extra" && card.hasImage && !previewSrc ? `/api/collections/cards/${card.id}/image` : null,
  );
  const extraSrc = card.cardType === "extra" ? previewSrc || extraImage : undefined;
  return (
    <div className="pointer-events-none absolute z-[1] overflow-hidden" style={boxStyle(area.portrait)}>
      {card.cardType === "extra" ? (
        extraSrc ? (
          <img src={extraSrc} alt="" className="absolute -left-[18%] -top-[25%] h-[164%] w-[182%] max-w-none object-fill" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[18cqw] leading-none text-slate-400">{card.emoji || "✦"}</div>
        )
      ) : (
        <Portrait
          card={card}
          showImage={showImage}
          fade={false}
          position={card.cardType === "hattrick"
            ? "absolute left-1/2 -top-[36%] h-[136%] w-[136%] max-w-none -translate-x-1/2 object-cover object-top"
            : card.cardType === "mvp" || card.cardType === "totm"
              ? "absolute left-1/2 -top-[31%] h-[131%] w-[131%] max-w-none -translate-x-1/2 object-cover object-top"
              : "h-full w-full object-[center_22%]"}
        />
      )}
    </div>
  );
}

function ScoreSide({
  label,
  goals,
  tone,
  win,
}: {
  label: string;
  goals: number;
  tone: "blue" | "red";
  win: boolean;
}) {
  return (
    <div className={cn(
      "flex min-w-0 flex-1 flex-col items-center",
      win && tone === "blue" && "text-sky-200 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]",
      win && tone === "red" && "text-rose-200 drop-shadow-[0_0_6px_rgba(251,113,133,0.9)]",
      !win && "text-white/75",
    )}>
      <span className="max-w-full truncate font-bold uppercase tracking-[0.12em] text-[3cqw]">{label}</span>
      <span className="font-black tabular-nums leading-none text-[13cqw]">{goals}</span>
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

function MvpPlate({
  card,
  full,
  locale,
  t,
  rarity,
}: {
  card: AlbumCard;
  full: boolean;
  locale: string;
  t: Translator;
  rarity?: string;
}) {
  const name = card.playerName || t("collection.unknownPlayer");
  const when = eventDate(card.occurredAt, locale);
  const score = scoreContext(card);
  const counts = typeof card.goals === "number" || typeof card.assists === "number"
    ? [countPhrase(card.goals ?? 0, "goal", t), countPhrase(card.assists ?? 0, "assist", t)].join(" · ")
    : "";
  const result = matchOutcome(card, t);
  const fact = "text-[3.3cqw] tracking-tight";
  const area = FRAME_LAYOUT.mvp;
  return (
    <>
      <SafeArea box={area.name} className="flex flex-col items-center justify-center text-center">
        {rarity ? <div className={cn("max-w-full truncate font-bold uppercase leading-none tracking-[0.16em]", full ? "text-[2.6cqw]" : "text-[3.3cqw]")}>{rarity}</div> : null}
        <div className={cn("max-w-full truncate font-black uppercase leading-none tracking-wide", full ? "text-[4.6cqw]" : "text-[6cqw]")}>{name}</div>
      </SafeArea>
      <SafeArea box={area.facts} className="flex flex-col justify-center">
        <FactLine left={when} right={score || undefined} className={cn("font-bold uppercase leading-none", fact)} />
        <FactLine left={counts} right={result || undefined} className={cn("mt-px font-bold uppercase leading-none", fact)} />
      </SafeArea>
    </>
  );
}

function HattrickPlate({
  card,
  full,
  locale,
  t,
  rarity,
}: {
  card: AlbumCard;
  full: boolean;
  locale: string;
  t: Translator;
  rarity?: string;
}) {
  const name = card.playerName || t("collection.unknownPlayer");
  const when = eventDate(card.occurredAt, locale);
  const score = scoreContext(card);
  const counts = typeof card.goals === "number" || typeof card.assists === "number"
    ? [countPhrase(card.goals ?? 0, "goal", t), countPhrase(card.assists ?? 0, "assist", t)].join(" · ")
    : "";
  const result = matchOutcome(card, t);
  const fact = full ? "text-[2.9cqw] tracking-tight" : "text-[3.2cqw] tracking-tight";
  const area = FRAME_LAYOUT.hattrick;
  return (
    <>
      <SafeArea box={area.name} className="flex flex-col items-center justify-center text-center">
        {rarity ? <div className={cn("max-w-full truncate font-bold uppercase leading-none tracking-[0.16em]", full ? "text-[2.4cqw]" : "text-[2.8cqw]")}>{rarity}</div> : null}
        <div className={cn("max-w-full truncate font-black uppercase leading-none tracking-wide", full ? "text-[4.4cqw]" : "text-[5.2cqw]")}>{name}</div>
      </SafeArea>
      <SafeArea box={area.facts} className="flex flex-col justify-center">
        <FactLine left={when} right={score || undefined} className={cn("font-bold uppercase leading-none", fact)} />
        <FactLine left={counts} right={result || undefined} className={cn("mt-px font-bold uppercase leading-none", fact)} />
      </SafeArea>
    </>
  );
}

function PlayerPlate({
  card,
  full,
  rarity,
  contextName,
}: {
  card: AlbumCard;
  full: boolean;
  rarity?: string;
  contextName?: string;
}) {
  const name = card.playerName || "";
  const season = card.seasonKey || currentSeasonKey();
  const fact = full ? "text-[3.3cqw] tracking-tight" : "text-[3.8cqw] tracking-tight";
  const area = FRAME_LAYOUT.player;
  return (
    <>
      <SafeArea box={area.name} className="flex flex-col items-center justify-center text-center">
        {rarity ? <div className={cn("max-w-full truncate font-bold uppercase leading-none tracking-[0.16em]", full ? "text-[2.6cqw]" : "text-[3cqw]")}>{rarity}</div> : null}
        {name ? <div className={cn("max-w-full truncate font-black uppercase leading-none tracking-wide", full ? "text-[4.6cqw]" : "text-[5.4cqw]")}>{name}</div> : null}
      </SafeArea>
      <SafeArea box={area.facts} className="flex items-center">
        <FactLine left={contextName} right={season || undefined} className={cn("w-full font-bold uppercase leading-none", fact)} />
      </SafeArea>
    </>
  );
}

function TotmPlate({
  card,
  full,
  locale,
  t,
  rarity,
}: {
  card: AlbumCard;
  full: boolean;
  locale: string;
  t: Translator;
  rarity?: string;
}) {
  const name = card.playerName || t("collection.unknownPlayer");
  const month = monthLine(card.payload.month, locale, !full);
  const goals = typeof card.goals === "number" ? countPhrase(card.goals, "goal", t) : "";
  const assists = typeof card.assists === "number" ? countPhrase(card.assists, "assist", t) : "";
  const fact = full ? "text-[3.3cqw] tracking-tight" : "text-[3.8cqw] tracking-tight";
  const area = FRAME_LAYOUT.totm;
  return (
    <>
      <SafeArea box={area.name} className="flex flex-col items-center justify-center text-center">
        {rarity ? <div className={cn("max-w-full truncate font-bold uppercase leading-none tracking-[0.16em]", full ? "text-[2.4cqw]" : "text-[2.6cqw]")}>{rarity}</div> : null}
        <div className={cn("max-w-full truncate font-black uppercase leading-none tracking-wide", full ? "text-[4.2cqw]" : "text-[4.8cqw]")}>{name}</div>
        {month ? <div className={cn("max-w-full truncate font-bold uppercase leading-none tracking-wide", full ? "text-[2.8cqw]" : "text-[3cqw]")}>{month}</div> : null}
      </SafeArea>
      <SafeArea box={area.facts} className="flex items-center">
        <FactLine left={goals} right={assists || undefined} className={cn("w-full font-bold uppercase leading-none", fact)} />
      </SafeArea>
    </>
  );
}

function MatchBoard({ card, locale, t, rarity }: { card: AlbumCard; locale: string; t: Translator; rarity?: string }) {
  const sides = matchSides(card, t);
  const when = eventDate(card.occurredAt, locale);
  const winner = !sides || sides.leftGoals === sides.rightGoals ? "draw" : sides.leftGoals > sides.rightGoals ? "blue" : "red";
  const center = FRAME_LAYOUT.match.center;
  if (!center) return null;
  return (
    <SafeArea box={center} className="flex items-center justify-center text-center [text-shadow:0_2px_4px_rgba(0,0,0,0.85)]">
      <div className="w-full min-w-0">
      <div className="-translate-y-[1.8cqw]">
      {rarity ? <div className="truncate font-bold uppercase tracking-[0.16em] text-[3.6cqw]">{rarity}</div> : null}
      {when ? <div className="truncate font-bold uppercase tracking-[0.12em] text-[5cqw]">{when}</div> : null}
      </div>
      {sides ? (
        <div className="mt-[0.4cqw] flex w-full items-end justify-center">
          <ScoreSide label={sides.leftLabel} goals={sides.leftGoals} tone="blue" win={winner === "blue"} />
          <span className="px-[1cqw] pb-[1cqw] text-[7cqw] leading-none text-white">—</span>
          <ScoreSide label={sides.rightLabel} goals={sides.rightGoals} tone="red" win={winner === "red"} />
        </div>
      ) : null}
      {card.seasonKey ? <div className="truncate uppercase tracking-[0.14em] text-[3.2cqw]">{card.seasonKey}</div> : null}
      </div>
    </SafeArea>
  );
}

function ExtraPlate({ card, full, t }: { card: AlbumCard; full: boolean; t: Translator }) {
  const title = card.title || t("collection.cards.extra");
  const area = FRAME_LAYOUT.extra;
  return (
    <>
      <SafeArea box={area.name} className="flex items-center justify-center text-center">
        <div className={cn("max-w-full truncate font-black uppercase leading-none tracking-wide", full ? "text-[4cqw]" : "text-[4.6cqw]")}>{title}</div>
      </SafeArea>
      <SafeArea box={area.facts} className="flex flex-col items-center justify-center text-center">
        {card.subtitle ? <div className={cn("max-w-full truncate font-bold uppercase leading-none tracking-wide", full ? "text-[2.6cqw]" : "text-[3cqw]")}>{card.subtitle}</div> : null}
        {card.body ? <p className={cn("line-clamp-2 max-w-full leading-tight text-white/85", full ? "text-[2.1cqw]" : "text-[2.3cqw]")}>{card.body}</p> : null}
      </SafeArea>
    </>
  );
}

export default function CollectionCard({
  card,
  mode,
  onOpen,
  contextName,
  previewSrc,
}: {
  card: AlbumCard;
  mode: "placeholder" | "thumbnail" | "full";
  onOpen?: () => void;
  contextName?: string;
  previewSrc?: string;
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
  const layout = FRAME_LAYOUT[card.cardType];
  const artSrc = (full || visible) ? layout?.src : undefined;
  const framed = Boolean(layout);
  const heroBox = layout?.hero;
  const hero = heroBox ? cardHero(card, i18n.language) : null;
  const heroFont = hero && heroBox ? heroTextSize(hero.value, heroBox) : null;

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
      <CardArt card={card} showImage={showImage} previewSrc={previewSrc} />
      {hero && heroBox && heroFont ? (
        <div
          className="pointer-events-none absolute z-30 flex flex-col items-center justify-center overflow-hidden text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]"
          style={heroBox}
        >
          <div className="max-w-full text-center font-black tabular-nums leading-none" style={{ fontSize: heroFont.value }}>{hero.value}</div>
          <div className="max-w-full truncate font-bold uppercase leading-none tracking-[0.06em]" style={{ fontSize: heroFont.label }}>{t(hero.labelKey)}</div>
        </div>
      ) : null}
      {card.cardType === "match" ? (
        <MatchBoard card={card} locale={i18n.language} t={t} rarity={framed ? rarity : undefined} />
      ) : card.cardType === "mvp" ? (
        <MvpPlate card={card} full={full} locale={i18n.language} t={t} rarity={rarity} />
      ) : card.cardType === "hattrick" ? (
        <HattrickPlate card={card} full={full} locale={i18n.language} t={t} rarity={rarity} />
      ) : card.cardType === "player" ? (
        <PlayerPlate card={card} full={full} rarity={rarity} contextName={contextName} />
      ) : card.cardType === "totm" ? (
        <TotmPlate card={card} full={full} locale={i18n.language} t={t} rarity={rarity} />
      ) : card.cardType === "extra" ? (
        <ExtraPlate card={card} full={full} t={t} />
      ) : (
        <div className={cn(
          "absolute z-10",
          framed
            ? "inset-x-[16%] bottom-[12%] [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]"
            : "inset-x-2 bottom-[7%] z-20 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]",
        )}>
          <FaceCopy card={card} full={full} locale={i18n.language} t={t} rarity={framed ? rarity : undefined} contextName={contextName} />
        </div>
      )}
      {artSrc ? <CardFrame src={artSrc} tint={card.cardType === "extra" ? extraFrameTint(card.rarity) : undefined} /> : null}
      {card.ownedQuantity > 1 ? (
        <span
          className="absolute z-30 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold leading-none text-emerald-300"
          style={markAnchor(layout, "right")}
        >
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
        <span
          className="absolute z-30 bg-slate-200/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-slate-900"
          style={markAnchor(layout, "left")}
        >
          {t("collection.retired")}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "relative flex aspect-[5/7] w-full flex-col overflow-hidden text-left [container-type:inline-size]",
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
