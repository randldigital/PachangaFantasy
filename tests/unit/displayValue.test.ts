import { describe, expect, it } from "vitest";
import {
  DISPLAY_VALUE_MULTIPLIER,
  formatDisplayMarketValue,
  formatDisplayMarketValueDelta,
} from "@shared/domain/displayValue";

describe("display market value", () => {
  it("uses the 500k display multiplier", () => {
    expect(DISPLAY_VALUE_MULTIPLIER).toBe(500_000);
  });

  it("formats player values and budgets as millions", () => {
    expect(formatDisplayMarketValue(1)).toBe("0.5M");
    expect(formatDisplayMarketValue(10)).toBe("5M");
    expect(formatDisplayMarketValue(15)).toBe("7.5M");
    expect(formatDisplayMarketValue(18)).toBe("9M");
    expect(formatDisplayMarketValue(100)).toBe("50M");
    expect(formatDisplayMarketValue(0)).toBe("0M");
  });

  it("formats deltas with a sign", () => {
    expect(formatDisplayMarketValueDelta(1)).toBe("+0.5M");
    expect(formatDisplayMarketValueDelta(-1)).toBe("-0.5M");
    expect(formatDisplayMarketValueDelta(0)).toBe("0M");
  });
});
