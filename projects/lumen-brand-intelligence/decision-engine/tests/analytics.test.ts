import assert from "node:assert/strict";
import test from "node:test";

import {
  UnsafeAnalyticsEventError,
  aggregateBrandEvents,
  createEngineEvent,
  sanitizeEngineEvent,
  validateSafeEngineEvent,
} from "../src/analytics.ts";
import type { EngineEvent } from "../src/types.ts";

const generatedAt = "2026-10-03T16:00:00+09:00";

const defaultSequence: Record<string, number> = {
  chat_question_asked: 1,
  chat_intent_classified: 2,
  clarification_answered: 3,
  safety_check_passed: 4,
  engine_verdict_generated: 5,
  candidate_generated: 6,
  candidate_eligible: 7,
  recommendation_ranked: 8,
  candidate_filtered: 7,
  candidate_data_gap: 8,
  candidate_diversity_held: 8,
  recommendation_impression: 9,
  evidence_opened: 10,
  product_clicked: 11,
};

function event(
  eventId: string,
  eventName: Parameters<typeof createEngineEvent>[0]["eventName"],
  overrides: Omit<Partial<EngineEvent>, "eventName"> = {},
): EngineEvent {
  return createEngineEvent({
    eventId,
    eventName,
    occurredAt: "2026-10-03T15:00:00+09:00",
    eventSequence: defaultSequence[eventName] ?? 1,
    journeyId: "journey-1",
    anonymousUserId: "user-1",
    anonymousSessionId: "session-1",
    scenarioId: "scenario-1",
    requestScope: "brand_aggregate",
    consentPolicyVersion: "consent-v1",
    synthetic: true,
    engineVersion: "demo-v1",
    ruleVersion: "rules-v1",
    evidenceVersion: "evidence-v1",
    ...overrides,
  });
}

test("funnel counts unique sessions and uses the previous stage as denominator", () => {
  const events = [
    event("q-1", "chat_question_asked"),
    event("q-2", "chat_question_asked", { anonymousSessionId: "session-2" }),
    event("i-1", "chat_intent_classified", { intentCode: "PROTEIN_SUPPORT" }),
    event("i-2", "chat_intent_classified", {
      anonymousSessionId: "session-2",
      intentCode: "PROTEIN_SUPPORT",
    }),
    event("c-1", "clarification_answered"),
    event("c-2", "clarification_answered"),
    event("s-1", "safety_check_passed"),
    event("g-1", "candidate_generated", { productId: "plant-protein" }),
    event("r-1", "recommendation_impression", { productId: "plant-protein" }),
  ];

  const aggregate = aggregateBrandEvents(events, generatedAt);

  assert.deepEqual(aggregate.funnel.slice(0, 6), [
    { stage: "question_asked", count: 2, denominator: null },
    { stage: "intent_classified", count: 2, denominator: 2 },
    { stage: "clarification_completed", count: 1, denominator: 2 },
    { stage: "safety_passed", count: 1, denominator: 1 },
    { stage: "candidate_generated", count: 1, denominator: 1 },
    { stage: "recommendation_impression", count: 1, denominator: 1 },
  ]);
  assert.equal(aggregate.sourceSessionCount, 2);
});

test("summarizes verdicts, exclusions, product eligibility, and data gaps deterministically", () => {
  const events = [
    event("v-2", "engine_verdict_generated", {
      anonymousSessionId: "session-2",
      verdictCode: "show_eligible_products",
    }),
    event("v-1", "engine_verdict_generated", {
      verdictCode: "show_eligible_products",
    }),
    event("v-3", "engine_verdict_generated", {
      anonymousSessionId: "session-3",
      verdictCode: "insufficient_data",
    }),
    event("p1-c1", "candidate_generated", { productId: "product-b" }),
    event("p1-e1", "candidate_eligible", { productId: "product-b" }),
    event("p1-r1", "recommendation_ranked", { productId: "product-b" }),
    event("p2-c1", "candidate_generated", { productId: "product-a" }),
    event("p2-x1", "candidate_filtered", {
      productId: "product-a",
      reasonCode: "ALLERGEN_MATCH",
    }),
    event("p2-x2", "candidate_filtered", {
      productId: "product-a",
      reasonCode: "ALLERGEN_MATCH",
    }),
    event("p2-g1", "candidate_data_gap", {
      productId: "product-a",
      reasonCode: "LABEL_MISSING",
    }),
    event("p2-xgap", "candidate_filtered", {
      productId: "product-a",
      reasonCode: "LABEL_MISSING",
    }),
  ];

  const aggregate = aggregateBrandEvents(events.reverse(), generatedAt);

  assert.deepEqual(aggregate.verdicts, [
    { code: "show_eligible_products", count: 2 },
    { code: "insufficient_data", count: 1 },
  ]);
  assert.deepEqual(aggregate.exclusions, [
    { reasonCode: "ALLERGEN_MATCH", count: 2 },
    { reasonCode: "LABEL_MISSING", count: 1 },
  ]);
  assert.deepEqual(aggregate.dataGaps, [{ reasonCode: "LABEL_MISSING", count: 1 }]);
  assert.deepEqual(aggregate.productGaps, [
    {
      productId: "product-a",
      candidateCount: 1,
      eligibleCount: 0,
      excludedCount: 1,
      dataGapCount: 1,
      topReasons: [
        { reasonCode: "ALLERGEN_MATCH", count: 2 },
        { reasonCode: "LABEL_MISSING", count: 1 },
      ],
      dataGapReasons: [{ reasonCode: "LABEL_MISSING", count: 1 }],
    },
    {
      productId: "product-b",
      candidateCount: 1,
      eligibleCount: 1,
      excludedCount: 0,
      dataGapCount: 0,
      topReasons: [],
      dataGapReasons: [],
    },
  ]);
});

test("rejects raw health and identity fields while stripping harmless metadata", () => {
  const safe = event("safe-1", "chat_question_asked");
  const sanitized = sanitizeEngineEvent({ ...safe, debugBuild: "local" });

  assert.deepEqual(sanitized, safe);
  assert.throws(
    () => validateSafeEngineEvent({ ...safe, debugBuild: "local" }),
    /non-allowlisted fields/,
  );
  assert.throws(
    () => sanitizeEngineEvent({ ...safe, rawQuestion: "왜 심장이 빨리 뛰나요?" }),
    (error: unknown) =>
      error instanceof UnsafeAnalyticsEventError && /rawQuestion/.test(error.message),
  );
  assert.throws(
    () => sanitizeEngineEvent({ ...safe, medicationDose: "secret" }),
    UnsafeAnalyticsEventError,
  );
  assert.throws(
    () => sanitizeEngineEvent({ ...safe, userId: "real-user-id" }),
    UnsafeAnalyticsEventError,
  );
  assert.throws(
    () =>
      sanitizeEngineEvent({
        ...safe,
        eventName: "not_allowlisted",
      }),
    UnsafeAnalyticsEventError,
  );
});

test("deduplicates identical event ids, rejects conflicts, and propagates synthetic flags", () => {
  const synthetic = event("same-id", "chat_question_asked");
  const live = event("live-id", "chat_question_asked", {
    anonymousSessionId: "session-2",
    synthetic: false,
  });

  const syntheticOnly = aggregateBrandEvents([synthetic, { ...synthetic }], generatedAt);
  assert.equal(syntheticOnly.sourceEventCount, 1);
  assert.equal(syntheticOnly.synthetic, true);
  assert.equal(syntheticOnly.syntheticEventCount, 1);
  assert.equal(syntheticOnly.nonSyntheticEventCount, 0);

  const mixed = aggregateBrandEvents([synthetic, live], generatedAt);
  assert.equal(mixed.synthetic, false);
  assert.equal(mixed.syntheticEventCount, 1);
  assert.equal(mixed.nonSyntheticEventCount, 1);

  assert.throws(
    () =>
      aggregateBrandEvents(
        [synthetic, { ...synthetic, anonymousSessionId: "session-conflict" }],
        generatedAt,
      ),
    /conflicting content/,
  );
});

test("funnel only counts stages reached in order within the same request", () => {
  const events = [
    event("ordered-q", "chat_question_asked", { eventSequence: 1 }),
    event("ordered-i", "chat_intent_classified", {
      eventSequence: 2,
      intentCode: "PROTEIN_SUPPORT",
    }),
    event("ordered-c", "clarification_answered", { eventSequence: 3 }),
    // Candidate generation happened before the safety gate: it must not count
    // as funnel progress even though both events exist in the request.
    event("out-of-order-g", "candidate_generated", {
      eventSequence: 4,
      productId: "plant-protein",
    }),
    event("ordered-s", "safety_check_passed", { eventSequence: 5 }),
    event("ordered-r", "recommendation_impression", {
      eventSequence: 6,
      productId: "plant-protein",
    }),
  ];

  const aggregate = aggregateBrandEvents(events, generatedAt);
  assert.equal(aggregate.funnel.find((item) => item.stage === "safety_passed")?.count, 1);
  assert.equal(aggregate.funnel.find((item) => item.stage === "candidate_generated")?.count, 0);
  assert.equal(aggregate.funnel.find((item) => item.stage === "recommendation_impression")?.count, 0);
});

test("counts a pseudonymous user as returning only across distinct request sessions", () => {
  const events = [
    event("visit-1", "chat_question_asked"),
    event("visit-2", "chat_question_asked", {
      anonymousSessionId: "session-2",
      scenarioId: "scenario-2",
      eventSequence: 1,
    }),
  ];
  const aggregate = aggregateBrandEvents(events, generatedAt);

  assert.equal(aggregate.sourceSessionCount, 2);
  assert.equal(aggregate.sourceUserCount, 1);
  assert.equal(aggregate.returningUserCount, 1);
});
