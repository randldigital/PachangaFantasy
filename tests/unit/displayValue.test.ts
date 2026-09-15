import { describe, expect, it } from "vitest";
import {
  DISPLAY_VALUE_MULTIPLIER,
  formatDisplayMarketValue,
  formatDisplayMarketValueDelta,
} from "@shared/domain/displayValue";

describe("display market value", () => {
  it("uses the 335k display multiplier", () => {
    expect(DISPLAY_VALUE_MULTIPLIER).toBe(335_000);
  });

  it("formats player values and budgets as millions", () => {
    expect(formatDisplayMarketValue(18)).toBe("6.03M");
    expect(formatDisplayMarketValue(100)).toBe("33.5M");
    expect(formatDisplayMarketValue(1)).toBe("0.34M");
    expect(formatDisplayMarketValue(0)).toBe("0M");
  });

  it("formats deltas with a sign", () => {
    expect(formatDisplayMarketValueDelta(1)).toBe("+0.34M");
    expect(formatDisplayMarketValueDelta(-1)).toBe("-0.34M");
    expect(formatDisplayMarketValueDelta(0)).toBe("0M");
  });
});
