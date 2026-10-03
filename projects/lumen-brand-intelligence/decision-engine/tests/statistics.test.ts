import assert from "node:assert/strict";
import test from "node:test";

import { analyzeMetricChanges } from "../src/statistics.ts";
import type {
  DailyMetricObservation,
  EngineConfig,
  EngineInput,
  MetricKey,
} from "../src/types.ts";

const config: EngineConfig = {
  engineVersion: "test",
  ruleVersion: "test",
  evidenceSnapshot: "test",
  productSnapshot: "test",
  consentPolicyVersion: "consent-test-v1",
  baselineMinDays: 5,
  postMinDays: 5,
  completenessPass: 0.8,
  completenessFail: 0.5,
  labelFreshnessDays: 30,
  familyAlpha: 0.05,
};

function observation(
  metric: MetricKey,
  date: string,
  value: number,
  deviceId = "watch-a",
  completeness = 1,
): DailyMetricObservation {
  return { metric, date, value, unit: metric === "steps" ? "count" : "bpm", deviceId, completeness, synthetic: true };
}

function input(metrics: DailyMetricObservation[]): EngineInput {
  return {
    requestId: "request-1",
    userId: "user-1",
    asOf: "2026-10-03T17:00:00+09:00",
    timezone: "Asia/Seoul",
    synthetic: true,
    consentScopes: ["service"],
    consentPolicyVersion: "consent-test-v1",
    screening: {
      redFlagSymptoms: "no",
      adultStatus: "adult",
      pregnantOrLactating: "no",
      eatingDisorderConcern: "no",
      allergens: "confirmed_none",
    },
    demographics: { adultConfirmed: true },
    constraints: {
      allergies: [], diagnoses: [], clinicianDietRestrictions: [], dietaryPreferences: [], currentSupplements: [],
    },
    metrics,
    medicationEvents: [{
      occurredAt: "2026-09-20T08:00:00+09:00",
      kind: "titration",
      medicationClass: "glp1",
    }],
    symptoms: [],
    nutrition: {},
    question: { text: "변화가 있나요?", intentCodes: ["CHANGE"], capturedAt: "2026-10-03T12:00:00+09:00" },
  };
}

const before = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"];
const after = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"];

test("finds a clear event-aligned change and reports all effect sizes", () => {
  const metrics = [
    ...before.map((date, index) => observation("resting_heart_rate", date, [60, 61, 59, 60, 62, 58][index])),
    ...after.map((date, index) => observation("resting_heart_rate", date, [70, 72, 69, 71, 73, 68][index])),
  ];
  // The event-day value is deliberately extreme and must not enter either window.
  metrics.push(observation("resting_heart_rate", "2026-09-20", 500));

  const [result] = analyzeMetricChanges(input(metrics), config, { windowDays: 7, hacLag: 1 });
  assert.equal(result.baselineDays, 6);
  assert.equal(result.postDays, 6);
  assert.equal(result.baselineMean, 60);
  assert.equal(result.postMean, 70.5);
  assert.equal(result.absoluteChange, 10.5);
  assert.equal(result.percentChange, 17.5);
  assert.ok(result.standardizedChange !== null && result.standardizedChange > 6);
  assert.equal(result.magnitude, "large");
  assert.equal(result.direction, "up");
  assert.equal(result.dataQuality, "pass");
  assert.equal(result.uncertainty, "low");
  assert.ok(result.ci95 !== null && result.ci95[0] > 0);
  assert.ok(result.approximatePValue !== null && result.approximatePValue > 0 && result.approximatePValue < 0.001);
  assert.ok(result.adjustedPValue !== null && result.adjustedPValue > 0 && result.adjustedPValue < 0.001);
});

test("labels a noisy change as uncertain when its HAC interval includes zero", () => {
  const metrics = [
    ...before.map((date, index) => observation("resting_heart_rate", date, [55, 66, 56, 67, 54, 68][index])),
    ...after.map((date, index) => observation("resting_heart_rate", date, [59, 69, 53, 70, 57, 65][index])),
  ];
  const [result] = analyzeMetricChanges(input(metrics), config, { windowDays: 7, hacLag: 1 });
  assert.equal(result.direction, "flat");
  assert.equal(result.uncertainty, "high");
  assert.ok(result.ci95 !== null && result.ci95[0] < 0 && result.ci95[1] > 0);
  assert.ok(result.warnings.includes("CI_INCLUDES_ZERO"));
  assert.ok(result.adjustedPValue !== null && result.adjustedPValue > 0.05);
});

test("fails comparability on a device switch and fails sparse windows", () => {
  const switched = [
    ...before.map((date) => observation("resting_heart_rate", date, 60, "watch-a")),
    ...after.map((date) => observation("resting_heart_rate", date, 65, "watch-b")),
  ];
  const [deviceResult] = analyzeMetricChanges(input(switched), config, { windowDays: 7 });
  assert.equal(deviceResult.dataQuality, "fail");
  assert.equal(deviceResult.ci95, null);
  assert.equal(deviceResult.approximatePValue, null);
  assert.ok(deviceResult.warnings.includes("DEVICE_CHANGED_ACROSS_WINDOWS"));

  const sparse = [
    ...before.slice(0, 2).map((date) => observation("steps", date, 4_000)),
    ...after.slice(0, 2).map((date) => observation("steps", date, 5_000)),
  ];
  const [sparseResult] = analyzeMetricChanges(input(sparse), config, { windowDays: 7 });
  assert.equal(sparseResult.dataQuality, "fail");
  assert.equal(sparseResult.baselineDays, 2);
  assert.equal(sparseResult.postDays, 2);
  assert.ok(sparseResult.warnings.includes("INSUFFICIENT_BASELINE_DAYS"));
  assert.ok(sparseResult.warnings.includes("INSUFFICIENT_POST_DAYS"));
});

test("excludes unusably incomplete days and marks retained borderline coverage low quality", () => {
  const metrics = [
    ...before.map((date, index) => observation(
      "resting_heart_rate",
      date,
      60 + index,
      "watch-a",
      index === 0 ? 0.4 : 0.7,
    )),
    ...after.map((date, index) => observation(
      "resting_heart_rate",
      date,
      62 + index,
      "watch-a",
      index === 0 ? 0.4 : 0.7,
    )),
  ];
  const [result] = analyzeMetricChanges(input(metrics), config, { windowDays: 7 });
  assert.equal(result.baselineDays, 5);
  assert.equal(result.postDays, 5);
  assert.equal(result.dataQuality, "low");
  assert.ok(result.warnings.includes("OBSERVATIONS_BELOW_COMPLETENESS_FAIL_EXCLUDED"));
  assert.ok(result.warnings.includes("LOW_COMPLETENESS_PRESENT"));
});

test("Holm adjustment controls a multi-metric family and is deterministic", () => {
  const metrics: DailyMetricObservation[] = [];
  const series: Array<[MetricKey, number[], number[]]> = [
    ["resting_heart_rate", [60, 61, 59, 60, 62, 58], [64, 65, 63, 64, 66, 62]],
    ["respiratory_rate", [14, 15, 13, 14, 16, 12], [16, 17, 15, 16, 18, 14]],
    ["steps", [4_000, 5_000, 3_000, 4_500, 3_500, 5_500], [4_200, 5_100, 3_100, 4_400, 3_700, 5_300]],
  ];
  for (const [metric, baselineValues, postValues] of series) {
    before.forEach((date, index) => metrics.push(observation(metric, date, baselineValues[index])));
    after.forEach((date, index) => metrics.push(observation(metric, date, postValues[index])));
  }

  const first = analyzeMetricChanges(input(metrics), config, { windowDays: 7, hacLag: 1 });
  const second = analyzeMetricChanges(input(metrics), config, { windowDays: 7, hacLag: 1 });
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((result) => result.metric), ["respiratory_rate", "resting_heart_rate", "steps"]);
  for (const result of first) {
    if (result.approximatePValue !== null && result.adjustedPValue !== null) {
      assert.ok(result.adjustedPValue >= result.approximatePValue);
    }
  }
  const weakest = first.find((result) => result.metric === "steps")!;
  assert.ok(weakest.adjustedPValue !== null && weakest.adjustedPValue > 0.05);
});

test("empty windows use explicit nulls rather than NaN", () => {
  const metrics = after.map((date) => observation("resting_heart_rate", date, 65));
  const [result] = analyzeMetricChanges(input(metrics), config, { windowDays: 7 });

  assert.equal(result.baselineDays, 0);
  assert.equal(result.baselineMean, null);
  assert.equal(result.postMean, 65);
  assert.equal(result.absoluteChange, null);
  assert.equal(result.direction, "unknown");
});

test("extreme or zero-variance differences retain a positive nonzero p-value", () => {
  const metrics = [
    ...before.map((date) => observation("resting_heart_rate", date, 60)),
    ...after.map((date) => observation("resting_heart_rate", date, 70)),
  ];
  const [result] = analyzeMetricChanges(input(metrics), config, { windowDays: 7 });

  assert.ok(result.approximatePValue !== null && result.approximatePValue > 0);
  assert.ok(result.adjustedPValue !== null && result.adjustedPValue > 0);
  assert.ok(result.warnings.includes("ZERO_ESTIMATED_STANDARD_ERROR"));
});
