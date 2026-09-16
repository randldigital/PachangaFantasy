/** Display-only scale. Never use this in lineup cost, scoring, or persisted VM. */
export const DISPLAY_VALUE_MULTIPLIER = 500_000;

function trimTrailingZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}

/** `1` → `0.5M`, `10` → `5M`, `15` → `7.5M`. */
export function formatDisplayMarketValue(vm: number): string {
  const millions = (vm * DISPLAY_VALUE_MULTIPLIER) / 1_000_000;
  return `${trimTrailingZeros(millions.toFixed(2))}M`;
}

export function formatDisplayMarketValueDelta(delta: number): string {
  if (delta > 0) {
    return `+${formatDisplayMarketValue(delta)}`;
  }
  if (delta < 0) {
    return `-${formatDisplayMarketValue(Math.abs(delta))}`;
  }
  return formatDisplayMarketValue(0);
}
