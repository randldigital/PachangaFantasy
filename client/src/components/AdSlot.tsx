import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { isAdsEnabled, useAuthFeatures } from "@/lib/features";

type AdSlotId = "overview.banner" | "hub.sidebar";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadAdSense(client: string) {
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector("script[data-adsense-client]")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.dataset.adsenseClient = client;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("adsense"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function AdSlot({ slot }: { slot: AdSlotId }) {
  const { t } = useTranslation();
  const { data } = useAuthFeatures();
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const client = data?.adsClient ?? "";
  const unit = data?.adsSlots?.[slot] ?? "";
  const test = Boolean(data?.adsTest);

  useEffect(() => {
    if (!isAdsEnabled(data) || !client) {
      return;
    }
    let cancelled = false;
    loadAdSense(client)
      .then(() => {
        if (cancelled || pushed.current || !insRef.current) {
          return;
        }
        pushed.current = true;
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      })
      .catch(() => {
        /* Localhost often fails to load fill; the reserved box stays visible. */
      });
    return () => {
      cancelled = true;
    };
  }, [client, data, slot, test, unit]);

  if (!isAdsEnabled(data)) {
    return null;
  }

  return (
    <aside className="w-full my-3" aria-label={t("ads.label")}>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{t("ads.label")}</p>
      <div className="min-h-[90px] w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800/40">
        {client ? (
          <ins
            ref={insRef}
            className="adsbygoogle block w-full"
            style={{ display: "block", minHeight: 90 }}
            data-ad-client={client}
            data-ad-slot={unit || undefined}
            data-ad-format="auto"
            data-full-width-responsive="true"
            data-adtest={test ? "on" : undefined}
          />
        ) : null}
      </div>
    </aside>
  );
}
