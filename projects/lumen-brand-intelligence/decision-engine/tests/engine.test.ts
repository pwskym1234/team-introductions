import assert from "node:assert/strict";
import test from "node:test";
import { decide } from "../src/engine.ts";
import { createSyntheticCatalog, createSyntheticInputs } from "../src/fixtures.ts";

const catalog = createSyntheticCatalog();

test("normal scenario runs six judgments and excludes milk products before ranking", () => {
  const [input] = createSyntheticInputs();
  const result = decide(input, catalog);

  assert.deepEqual(result.judgments.map((item) => item.kind), ["change", "cause", "risk", "compare", "plateau", "effect"]);
  assert.equal(result.disposition, "show_eligible_products");
  assert.ok(result.judgments.some((item) => item.kind === "change" && item.status === "observable_change"));
  assert.ok(result.judgments.some((item) => item.kind === "cause" && item.status === "temporally_associated"));
  assert.ok(result.excluded.some((item) => item.product.productId === "P01" && item.exclusionReasons.some((reason) => reason.code === "ALLERGEN_MATCH")));
  assert.ok(result.eligible.every((item) => item.constraint === "pass" && typeof item.score === "number"));
  assert.equal(result.eligible.some((item) => item.product.productId === "P01"), false);
});

test("red flags stop all product evaluation and recommendation", () => {
  const [, input] = createSyntheticInputs();
  const result = decide(input, catalog);

  assert.equal(result.disposition, "safety_stop");
  assert.equal(result.eligible.length, 0);
  assert.equal(result.excluded.length, 0);
  assert.ok(result.judgments.some((item) => item.kind === "risk" && item.status === "safety_escalation"));
  assert.ok(result.events.some((event) => event.eventName === "guardrail_blocked"));
});

test("new device without baseline abstains for insufficient data", () => {
  const [, , input] = createSyntheticInputs();
  const result = decide(input, catalog);

  assert.equal(result.disposition, "insufficient_data");
  assert.equal(result.eligible.length, 0);
  assert.ok(result.judgments.some((item) => item.kind === "change" && item.status === "insufficient_data"));
});

test("medication choice requests are bounded even when metric data exists", () => {
  const [input] = createSyntheticInputs();
  input.question.text = "위고비보다 마운자로가 더 안전하니 바꿔야 하나요?";
  const result = decide(input, catalog);

  assert.equal(result.disposition, "medication_boundary");
  assert.equal(result.eligible.length, 0);
});

test("output and event IDs are deterministic for the same versioned input", () => {
  const [input] = createSyntheticInputs();
  const first = decide(input, catalog);
  const second = decide(input, catalog);

  assert.deepEqual(second, first);
  for (const event of first.events) {
    assert.equal("question" in event, false);
    assert.equal("symptoms" in event, false);
    assert.equal("medication" in event, false);
  }
});

test("red flag and protected-population safety outrank a medication boundary collision", () => {
  const [, input] = createSyntheticInputs();
  input.question.text = "반복해서 토하고 배가 심하게 아픈데 위고비 용량을 줄여야 하나요?";
  const result = decide(input, catalog);

  assert.equal(result.disposition, "safety_stop");
  assert.ok(result.judgments.some((item) => item.kind === "risk" && item.status === "safety_escalation"));

  const [protectedInput] = createSyntheticInputs();
  protectedInput.question.text = "임신 중인데 위고비 용량을 줄여야 하나요?";
  protectedInput.demographics.pregnantOrLactating = true;
  protectedInput.screening!.pregnantOrLactating = "yes";
  const protectedResult = decide(protectedInput, catalog);
  assert.equal(protectedResult.disposition, "safety_stop");
  assert.ok(
    protectedResult.judgments
      .find((item) => item.kind === "risk")
      ?.reasonCodes.includes("PROTECTED_POPULATION_PREGNANCY_LACTATION"),
  );
});

test("unknown safety and allergy screens request the highest-value answer and show no products", () => {
  const [screenOmitted] = createSyntheticInputs();
  delete screenOmitted.screening;
  const omittedResult = decide(screenOmitted, catalog);
  assert.equal(omittedResult.disposition, "ask_clarification");
  assert.equal(omittedResult.nextClarification?.code, "RED_FLAG_SCREEN");
  assert.equal(omittedResult.eligible.length, 0);

  const [safetyUnknown] = createSyntheticInputs();
  safetyUnknown.screening!.redFlagSymptoms = "unknown";
  const safetyResult = decide(safetyUnknown, catalog);
  assert.equal(safetyResult.disposition, "ask_clarification");
  assert.equal(safetyResult.nextClarification?.code, "RED_FLAG_SCREEN");
  assert.equal(safetyResult.nextClarification?.safetyGate, true);
  assert.equal(safetyResult.eligible.length, 0);
  assert.equal(safetyResult.events.some((event) => event.eventName === "safety_check_passed"), false);

  const [allergyUnknown] = createSyntheticInputs();
  allergyUnknown.screening!.allergens = "unknown";
  const allergyResult = decide(allergyUnknown, catalog);
  assert.equal(allergyResult.disposition, "ask_clarification");
  assert.equal(allergyResult.nextClarification?.code, "ALLERGENS_REVIEW");
  assert.equal(allergyResult.eligible.length, 0);
});

test("brand events require both aggregate scope and the current consent policy", () => {
  const [serviceOnly] = createSyntheticInputs();
  serviceOnly.consentScopes = ["service"];
  const noScope = decide(serviceOnly, catalog);
  assert.equal(noScope.analyticsEmission, "scope_missing");
  assert.deepEqual(noScope.events, []);

  const [stalePolicy] = createSyntheticInputs();
  stalePolicy.consentPolicyVersion = "brand-analytics-consent-old";
  const mismatch = decide(stalePolicy, catalog);
  assert.equal(mismatch.analyticsEmission, "policy_version_mismatch");
  assert.deepEqual(mismatch.events, []);
});

test("explicit intent retrieval keeps unrelated products out of candidates and gaps", () => {
  const [input] = createSyntheticInputs();
  const multivitamin = catalog.find((item) => item.productId === "P09")!;
  const result = decide(input, [multivitamin]);

  assert.deepEqual(result.retrieval, {
    catalogCount: 1,
    retrievedCount: 0,
    notRetrievedCount: 1,
    intentCodes: input.question.intentCodes,
  });
  assert.equal(result.eligible.length, 0);
  assert.equal(result.excluded.length, 0);
  assert.equal(result.events.some((event) => event.productId === "P09"), false);
});

test("engine-created analytics are sanitized, sequential and request-scoped", () => {
  const [input] = createSyntheticInputs();
  const result = decide(input, catalog);

  assert.ok(result.events.length > 0);
  assert.deepEqual(result.events.map((event) => event.eventSequence),
    result.events.map((_, index) => index + 1));
  assert.ok(result.events.every((event) => event.requestScope === "brand_aggregate"));
  assert.ok(result.events.every((event) => event.consentPolicyVersion === input.consentPolicyVersion));
  assert.equal(new Set(result.events.map((event) => event.journeyId)).size, 1);
  for (let index = 1; index < result.events.length; index += 1) {
    assert.ok(Date.parse(result.events[index].occurredAt) > Date.parse(result.events[index - 1].occurredAt));
  }
});

test("a failed metric is not hidden by other passing metrics in overall judgment quality", () => {
  const [input] = createSyntheticInputs();
  for (const observation of input.metrics) {
    if (observation.metric === "hrv_rmssd" && observation.date > "2026-09-19") {
      observation.deviceId = "replacement-device";
    }
  }
  const result = decide(input, catalog);
  const change = result.judgments.find((item) => item.kind === "change")!;

  assert.equal(change.dataQuality, "fail");
  assert.ok(change.metricChanges.some((item) => item.dataQuality === "pass"));
  assert.ok(change.metricChanges.some((item) => item.dataQuality === "fail"));
});
