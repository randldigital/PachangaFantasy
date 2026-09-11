import { describe, expect, it } from "vitest";
import { apiUrl } from "../../client/src/lib/apiBase";
import {
  FEATURE_CORE_CLUB,
  FEATURE_CORE_LEAGUE,
  FEATURE_PLUS_PLACEHOLDER,
  hasEntitlement,
} from "@shared/domain/entitlements";
import { isAdsEnabled as adsFromFeatures } from "../../client/src/lib/features";

describe("apiBase", () => {
  it("leaves same-origin paths unchanged when the prefix is empty", () => {
    expect(apiUrl("/api/leagues", "")).toBe("/api/leagues");
  });

  it("prefixes a packaged API origin", () => {
    expect(apiUrl("/api/leagues", "https://pachanga.example")).toBe(
      "https://pachanga.example/api/leagues",
    );
  });
});

describe("entitlements", () => {
  it("includes every 2.0 feature on free and reserves plus for the placeholder", () => {
    expect(hasEntitlement("free", FEATURE_CORE_LEAGUE)).toBe(true);
    expect(hasEntitlement("free", FEATURE_CORE_CLUB)).toBe(true);
    expect(hasEntitlement("free", FEATURE_PLUS_PLACEHOLDER)).toBe(false);
    expect(hasEntitlement("plus", FEATURE_PLUS_PLACEHOLDER)).toBe(true);
  });
});

describe("ads flag", () => {
  it("does not render ads when the feature is off", () => {
    expect(adsFromFeatures({ ads: false })).toBe(false);
    expect(adsFromFeatures({ ads: true })).toBe(true);
  });
});
