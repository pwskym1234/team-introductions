import type { EngineConfig } from "./types.ts";

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  engineVersion: "demo-engine-0.2.0",
  ruleVersion: "rules-2026-10-03-v2",
  evidenceSnapshot: "evidence-synthetic-2026-10-03",
  productSnapshot: "products-synthetic-2026-10-03",
  consentPolicyVersion: "brand-analytics-consent-2026-10-03-v1",
  baselineMinDays: 28,
  postMinDays: 7,
  completenessPass: 0.8,
  completenessFail: 0.5,
  labelFreshnessDays: 30,
  familyAlpha: 0.05
};
