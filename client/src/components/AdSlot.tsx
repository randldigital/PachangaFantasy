import { isAdsEnabled, useAuthFeatures } from "@/lib/features";

type AdSlotId = "overview.banner" | "hub.sidebar";

export default function AdSlot({ slot }: { slot: AdSlotId }) {
  const { data } = useAuthFeatures();
  if (!isAdsEnabled(data)) {
    return null;
  }
  return (
    <aside
      data-ad-slot={slot}
      className="hidden"
      aria-hidden="true"
    />
  );
}
