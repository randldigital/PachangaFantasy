import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { isAdsEnabled, useAuthFeatures } from "@/lib/features";

type AdSlotId = "overview.banner" | "hub.sidebar";

const SCRIPT_ATTR = "data-adsterra-zone";

function existingZoneScript(zone: string): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(`script[${SCRIPT_ATTR}="${zone}"]`);
}

function existingZoneContainer(zone: string): HTMLElement | null {
  return document.getElementById(`container-${zone}`);
}

/**
 * Load Adsterra adjustable unit: #container-{zone} + async script.
 * SPA-safe: remove the script and clear the container on unmount so a later mount can re-inject.
 */
function injectAdsterra(zone: string, host: HTMLElement): () => void {
  const containerId = `container-${zone}`;
  const other = existingZoneContainer(zone);
  if (other && other !== host) {
    // Another live slot already owns this zone id — do not duplicate.
    return () => undefined;
  }

  host.id = containerId;
  host.replaceChildren();

  let script = existingZoneScript(zone);
  let createdScript = false;
  if (!script) {
    script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.setAttribute(SCRIPT_ATTR, zone);
    script.src = `https://bicea.org/21/${zone}`;
    document.body.appendChild(script);
    createdScript = true;
  }

  return () => {
    if (createdScript && script?.parentNode) {
      script.parentNode.removeChild(script);
    }
    if (host.id === containerId) {
      host.replaceChildren();
      host.removeAttribute("id");
    }
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
  const unit = data?.adsSlots?.[slot] ?? "";
  const canFill = adsOn && Boolean(unit);

  useEffect(() => {
    if (!canFill) {
      return;
    }
    const host = hostRef.current;
    if (!host) {
      return;
    }
    return injectAdsterra(unit, host);
  }, [canFill, unit, slot]);

  if (!adsOn && !alwaysReserve) {
    return null;
  }

  return (
    <aside className={className ?? "w-full my-3"} aria-label={t("ads.label")}>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{t("ads.label")}</p>
      <div className="min-h-[90px] w-full rounded-md border border-slate-700 bg-slate-800/40">
        {canFill ? <div ref={hostRef} className="min-h-[90px] w-full" /> : null}
      </div>
    </aside>
  );
}
