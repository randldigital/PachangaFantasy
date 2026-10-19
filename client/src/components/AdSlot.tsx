import { useTranslation } from "react-i18next";
import { useIsDesktopLg } from "@/hooks/use-mobile";
import { isAdsEnabled, useAuthFeatures, type AdsterraSlotUnit } from "@/lib/features";

type AdSlotId = "overview.banner" | "hub.sidebar";

const SLOT_DEFAULTS: Record<AdSlotId, Pick<AdsterraSlotUnit, "width" | "height">> = {
  "overview.banner": { width: 300, height: 250 },
  "hub.sidebar": { width: 320, height: 50 },
};

/** Outer sandbox: scripts + same-origin + new-tab clicks; no top-page navigation. */
const AD_SANDBOX =
  "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

function frameSrc(key: string, width: number, height: number): string {
  const params = new URLSearchParams({
    key,
    width: String(width),
    height: String(height),
  });
  return `/ads/frame.html?${params.toString()}`;
}

export default function AdSlot({
  slot,
  alwaysReserve = false,
  className,
}: {
  slot: AdSlotId;
  /** Keep the reserved box even when ads are globally off (e.g. public landing). */
  alwaysReserve?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const { data } = useAuthFeatures();
  const adsOn = isAdsEnabled(data);
  const unit = data?.adsSlots?.[slot];
  const width = unit?.width ?? SLOT_DEFAULTS[slot].width;
  const height = unit?.height ?? SLOT_DEFAULTS[slot].height;
  const key = unit?.key ?? "";
  const canFill = adsOn && Boolean(key);

  if (!adsOn && !alwaysReserve) {
    return null;
  }

  return (
    <aside className={className ?? "w-full my-3"} aria-label={t("ads.label")}>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{t("ads.label")}</p>
      <div
        className="flex w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-800/40"
        style={{ minHeight: height }}
      >
        {canFill ? (
          <iframe
            title={t("ads.label")}
            src={frameSrc(key, width, height)}
            width={width}
            height={height}
            sandbox={AD_SANDBOX}
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            style={{ border: 0, width, height, overflow: "hidden" }}
          />
        ) : null}
      </div>
    </aside>
  );
}

/**
 * League/Club hub: 300×250 on desktop (lg+), 320×50 on smaller screens.
 * Waits for matchMedia so only one unit loads.
 */
export function HubAdSlot({ className }: { className?: string }) {
  const isDesktop = useIsDesktopLg();
  if (isDesktop === null) {
    return null;
  }
  return (
    <AdSlot
      slot={isDesktop ? "overview.banner" : "hub.sidebar"}
      className={className ?? "w-full my-0"}
    />
  );
}
