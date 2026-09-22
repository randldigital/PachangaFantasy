import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { isAdsEnabled, useAuthFeatures } from "@/lib/features";

type AdSlotId = "overview.banner" | "hub.sidebar";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & { loaded?: boolean };
  }
}

let scriptPromise: Promise<void> | null = null;

function existingAdSenseScript(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(
    'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"], script[data-adsense-client]',
  );
}

/**
 * Resolve only after adsbygoogle.js has loaded (or after a short poll).
 * Do not treat a pre-load queue array as "ready" — that races with React mount.
 */
function loadAdSense(client: string) {
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    const finish = () => resolve();

    const waitUntilReady = (script: HTMLScriptElement) => {
      if (window.adsbygoogle?.loaded || script.dataset.loaded === "1") {
        finish();
        return;
      }
      const onLoad = () => {
        script.dataset.loaded = "1";
        finish();
      };
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", () => reject(new Error("adsense")), { once: true });

      // Cached script: 'load' may never fire again — poll briefly then push anyway (queue is fine).
      let ticks = 0;
      const poll = window.setInterval(() => {
        ticks += 1;
        if (window.adsbygoogle?.loaded || script.dataset.loaded === "1") {
          window.clearInterval(poll);
          script.removeEventListener("load", onLoad);
          finish();
        } else if (ticks >= 40) {
          window.clearInterval(poll);
          finish();
        }
      }, 50);
    };

    const existing = existingAdSenseScript();
    if (existing) {
      waitUntilReady(existing);
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.dataset.adsenseClient = client;
    document.head.appendChild(script);
    waitUntilReady(script);
  });
  return scriptPromise;
}

export default function AdSlot({ slot }: { slot: AdSlotId }) {
  const { t } = useTranslation();
  const { data } = useAuthFeatures();
  const insRef = useRef<HTMLModElement>(null);
  const adsOn = isAdsEnabled(data);
  const client = data?.adsClient ?? "";
  const unit = data?.adsSlots?.[slot] ?? "";
  const test = Boolean(data?.adsTest);

  useEffect(() => {
    if (!adsOn || !client || !unit) {
      return;
    }
    let cancelled = false;

    void loadAdSense(client)
      .then(() => {
        if (cancelled) {
          return;
        }
        const node = insRef.current;
        if (!node) {
          return;
        }
        // Already requested a fill for this DOM node.
        if (node.getAttribute("data-adsbygoogle-status")) {
          return;
        }
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          /* Duplicate push is harmless. */
        }
      })
      .catch(() => {
        /* Blockers / offline leave the reserved box empty. */
      });

    return () => {
      cancelled = true;
    };
  }, [adsOn, client, unit, test, slot]);

  if (!adsOn) {
    return null;
  }

  return (
    <aside className="w-full my-3" aria-label={t("ads.label")}>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{t("ads.label")}</p>
      <div className="min-h-[90px] w-full rounded-md border border-slate-700 bg-slate-800/40">
        {client && unit ? (
          <ins
            key={`${slot}-${unit}-${test ? "test" : "live"}`}
            ref={insRef}
            className="adsbygoogle"
            style={{ display: "block", minHeight: 90, width: "100%" }}
            data-ad-client={client}
            data-ad-slot={unit}
            data-ad-format="auto"
            data-full-width-responsive="true"
            {...(test ? { "data-adtest": "on" } : {})}
          />
        ) : null}
      </div>
    </aside>
  );
}
