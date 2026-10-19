import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { isAdsEnabled, useAuthFeatures, type AdsterraSlotUnit } from "@/lib/features";

type AdSlotId = "overview.banner" | "hub.sidebar";

const SCRIPT_ATTR = "data-adsterra-key";

const SLOT_DEFAULTS: Record<AdSlotId, Pick<AdsterraSlotUnit, "width" | "height">> = {
  "overview.banner": { width: 300, height: 250 },
  "hub.sidebar": { width: 320, height: 50 },
};

/**
 * Load Adsterra fixed iframe unit: set atOptions, then /22/{key} script inside the host.
 * SPA-safe: clear the host on unmount so a later mount can re-inject.
 */
function injectAdsterraIframe(unit: AdsterraSlotUnit, host: HTMLElement): () => void {
  host.replaceChildren();

  const options = {
    key: unit.key,
    format: "iframe",
    height: unit.height,
    width: unit.width,
    params: {},
  };

  const config = document.createElement("script");
  config.text = `atOptions = ${JSON.stringify(options)};`;
  host.appendChild(config);

  const script = document.createElement("script");
  script.async = true;
  script.setAttribute("data-cfasync", "false");
  script.setAttribute(SCRIPT_ATTR, unit.key);
  script.src = `https://bicea.org/22/${unit.key}`;
  host.appendChild(script);

  return () => {
    host.replaceChildren();
  };
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
  const hostRef = useRef<HTMLDivElement>(null);
  const adsOn = isAdsEnabled(data);
  const unit = data?.adsSlots?.[slot];
  const width = unit?.width ?? SLOT_DEFAULTS[slot].width;
  const height = unit?.height ?? SLOT_DEFAULTS[slot].height;
  const key = unit?.key ?? "";
  const canFill = adsOn && Boolean(key);

  useEffect(() => {
    if (!canFill || !key) {
      return;
    }
    const host = hostRef.current;
    if (!host) {
      return;
    }
    return injectAdsterraIframe({ key, width, height }, host);
  }, [canFill, key, width, height, slot]);

  if (!adsOn && !alwaysReserve) {
    return null;
  }

  return (
    <aside className={className ?? "w-full my-3"} aria-label={t("ads.label")}>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{t("ads.label")}</p>
      <div
        className="flex w-full items-center justify-center rounded-md border border-slate-700 bg-slate-800/40"
        style={{ minHeight: height }}
      >
        {canFill ? (
          <div
            ref={hostRef}
            className="flex items-center justify-center overflow-hidden"
            style={{ width, height, minHeight: height }}
          />
        ) : null}
      </div>
    </aside>
  );
}
