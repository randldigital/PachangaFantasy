export const FEATURE_CORE_LEAGUE = "league.core";
export const FEATURE_CORE_CLUB = "club.core";
export const FEATURE_CORE_MATCH = "match.core";
export const FEATURE_CORE_LINEUP = "lineup.core";
export const FEATURE_CORE_VALUATION = "valuation.core";
export const FEATURE_CORE_CLAIMS = "claims.core";
export const FEATURE_PLUS_PLACEHOLDER = "org.plus_placeholder";
export const FEATURE_ADS_FREE = "org.ad_free";

export const FREE_FEATURES = [
  FEATURE_CORE_LEAGUE,
  FEATURE_CORE_CLUB,
  FEATURE_CORE_MATCH,
  FEATURE_CORE_LINEUP,
  FEATURE_CORE_VALUATION,
  FEATURE_CORE_CLAIMS,
] as const;

export const PLUS_FEATURES = [...FREE_FEATURES, FEATURE_PLUS_PLACEHOLDER, FEATURE_ADS_FREE] as const;

export type FeatureKey = (typeof PLUS_FEATURES)[number];
export type PlanCode = "free" | "plus" | string;

export const PLAN_CATALOG: {
  code: string;
  name: string;
  features: readonly string[];
}[] = [
  { code: "free", name: "Free", features: FREE_FEATURES },
  { code: "plus", name: "Plus", features: PLUS_FEATURES },
];

export function featuresForPlan(planCode: PlanCode): readonly string[] {
  if (planCode === "plus") {
    return PLUS_FEATURES;
  }
  return FREE_FEATURES;
}

export function hasEntitlement(planCode: PlanCode, feature: string): boolean {
  return featuresForPlan(planCode).includes(feature);
}

/** Hub AdSlot only after the org plan is known, and never on Plus. Overview/Billing ignore this. */
export function shouldRenderHubAd(planCode: string | undefined | null): boolean {
  if (!planCode) {
    return false;
  }
  return !hasEntitlement(planCode, FEATURE_ADS_FREE);
}

export function catalogPlans() {
  return PLAN_CATALOG.map((plan) => ({
    code: plan.code,
    name: plan.name,
    features: [...plan.features],
    comparison: PLUS_FEATURES.map((feature) => ({
      feature,
      included: hasEntitlement(plan.code, feature),
    })),
  }));
}
