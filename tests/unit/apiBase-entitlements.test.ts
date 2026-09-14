import { describe, expect, it } from "vitest";
import { apiUrl } from "../../client/src/lib/apiBase";
import {
  FEATURE_ADS_FREE,
  FEATURE_CORE_CLUB,
  FEATURE_CORE_LEAGUE,
  FEATURE_PLUS_PLACEHOLDER,
  hasEntitlement,
  shouldRenderHubAd,
} from "@shared/domain/entitlements";
import { isAdsEnabled as adsFromFeatures, isPaymentsEnabled } from "../../client/src/lib/features";

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
    expect(hasEntitlement("free", FEATURE_ADS_FREE)).toBe(false);
    expect(hasEntitlement("plus", FEATURE_ADS_FREE)).toBe(true);
  });

  it("hides hub ads on Plus and until the org plan is known", () => {
    expect(shouldRenderHubAd(undefined)).toBe(false);
    expect(shouldRenderHubAd("free")).toBe(true);
    expect(shouldRenderHubAd("plus")).toBe(false);
  });
});

describe("ads flag", () => {
  it("does not render ads when the feature is off", () => {
    expect(adsFromFeatures({ ads: false })).toBe(false);
    expect(adsFromFeatures({ ads: true })).toBe(true);
  });
});

describe("payments flag", () => {
  it("hides billing when payments are off", () => {
    expect(isPaymentsEnabled({ payments: false })).toBe(false);
    expect(isPaymentsEnabled({ payments: true })).toBe(true);
    expect(isPaymentsEnabled(undefined)).toBe(false);
  });
});
