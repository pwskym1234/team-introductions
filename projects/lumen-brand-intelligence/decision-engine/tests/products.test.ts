import assert from "node:assert/strict";
import test from "node:test";

import { evaluateProducts } from "../src/products.ts";
import type {
  EngineConfig,
  EngineInput,
  EvidenceRef,
  JudgmentResult,
  ProductCandidate,
} from "../src/types.ts";

const now = "2026-10-03T05:00:00.000Z";

const config: EngineConfig = {
  engineVersion: "test",
  ruleVersion: "test",
  evidenceSnapshot: "test",
  productSnapshot: "test",
  consentPolicyVersion: "consent-test-v1",
  baselineMinDays: 7,
  postMinDays: 7,
  completenessPass: 0.8,
  completenessFail: 0.5,
  labelFreshnessDays: 30,
  familyAlpha: 0.05,
};

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  const base: EngineInput = {
    requestId: "r1",
    userId: "u1",
    asOf: now,
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
      allergies: [],
      diagnoses: [],
      clinicianDietRestrictions: [],
      dietaryPreferences: [],
      currentSupplements: [],
      budgetKrw: 50_000,
      preferredFormats: ["powder"],
    },
    metrics: [],
    medicationEvents: [],
    symptoms: [],
    nutrition: {},
    question: { text: "단백질을 보완하고 싶어요", intentCodes: ["PROTEIN_SUPPORT"], capturedAt: now },
  };
  return { ...base, ...overrides };
}

const evidence: EvidenceRef = {
  id: "e1",
  claim: "protein support",
  sourceUrl: "https://example.test/evidence",
  sourceType: "systematic_review",
  population: "adults",
  outcome: "protein intake",
  limitations: [],
  reviewedAt: now,
  qualityScore: 0.9,
  populationApplicability: 0.9,
  doseApplicability: 0.8,
};

function product(productId: string, overrides: Partial<ProductCandidate["facts"]> = {}): ProductCandidate {
  return {
    productId,
    name: productId,
    category: "protein",
    supportedIntentCodes: ["PROTEIN_SUPPORT"],
    ingredientIds: [`ingredient-${productId}`],
    facts: {
      serving: "1 scoop",
      ingredientAmounts: { protein: 20 },
      allergens: [],
      allergenDeclarationStatus: "confirmed_none",
      contraindicatedDiagnoses: [],
      interactionReviewStatus: "cleared",
      officialFunctionClaims: ["protein support"],
      priceKrw: 30_000,
      sellerUrl: "https://example.test/buy",
      stock: "in_stock",
      labelSourceUrl: "https://example.test/label",
      checkedAt: "2026-09-30T05:00:00.000Z",
      preferredFormats: ["powder"],
      dietaryTags: ["vegan"],
      ...overrides,
    },
    evidenceRefs: [evidence],
    synthetic: true,
  };
}

function judgment(overrides: Partial<JudgmentResult> = {}): JudgmentResult {
  return {
    kind: "compare",
    status: "eligible",
    confidence: "high",
    metricChanges: [],
    explanation: { observation: [], possibleInterpretation: [], unknown: [], nextAction: [] },
    dataQuality: "pass",
    reasonCodes: [],
    computedAt: now,
    ...overrides,
  };
}

test("allergen match is excluded before scoring", () => {
  const candidate = product("whey", {
    allergens: ["milk"],
    allergenDeclarationStatus: "declared",
  });
  const result = evaluateProducts(
    input({ constraints: { ...input().constraints, allergies: ["milk"] } }),
    [candidate],
    [judgment()],
    config,
  );

  assert.equal(result.eligible.length, 0);
  assert.equal(result.excluded[0]?.constraint, "exclude");
  assert.ok(result.excluded[0]?.exclusionReasons.some(({ code }) => code === "ALLERGEN_MATCH"));
  assert.equal(result.excluded[0]?.score, undefined);
});

test("red flag blocks every product and produces no ranked product", () => {
  const risk = judgment({ kind: "risk", status: "safety_escalation" });
  const result = evaluateProducts(input(), [product("a"), product("b")], [risk], config);

  assert.equal(result.eligible.length, 0);
  assert.equal(result.excluded.length, 2);
  assert.ok(result.excluded.every((item) => item.exclusionReasons.some(({ code }) => code === "RED_FLAG_PRESENT")));
  assert.ok(result.excluded.every((item) => item.components === undefined));
});

test("unverified interaction is routed to expert review", () => {
  const candidate = product("review", { interactionReviewStatus: "unverified" });
  const result = evaluateProducts(input(), [candidate], [judgment()], config);

  assert.equal(result.eligible.length, 0);
  assert.equal(result.expertReview[0]?.constraint, "expert_review");
  assert.equal(result.excluded[0]?.constraint, "expert_review");
  assert.ok(result.expertReview[0]?.exclusionReasons.some(({ code }) => code === "INTERACTION_UNVERIFIED"));
});

test("missing and stale commerce evidence is hard-filtered", () => {
  const missing = product("missing", { labelSourceUrl: undefined, checkedAt: undefined });
  missing.evidenceRefs = [];
  const stale = product("stale", { checkedAt: "2026-07-01T05:00:00.000Z" });
  const result = evaluateProducts(input(), [missing, stale], [judgment()], config);

  const missingCodes = result.excluded
    .find((item) => item.product.productId === "missing")
    ?.exclusionReasons.map(({ code }) => code);
  const staleCodes = result.excluded
    .find((item) => item.product.productId === "stale")
    ?.exclusionReasons.map(({ code }) => code);
  assert.ok(missingCodes?.includes("LABEL_MISSING"));
  assert.ok(missingCodes?.includes("EVIDENCE_MISSING"));
  assert.ok(missingCodes?.includes("DATA_FRESHNESS_MISSING"));
  assert.ok(staleCodes?.includes("PRODUCT_DATA_STALE"));
});

test("ranking is deterministic, weighted, penalized for uncertainty, and diversity-deduped", () => {
  const strong = product("a-strong");
  strong.evidenceRefs = [{ ...evidence, qualityScore: 1, populationApplicability: 1, doseApplicability: 1 }];
  const weaker = product("b-weaker");
  weaker.evidenceRefs = [{ ...evidence, qualityScore: 0.3, populationApplicability: 0.5, doseApplicability: 0.5 }];
  const duplicate = product("z-duplicate");
  duplicate.category = strong.category;
  duplicate.ingredientIds = [...strong.ingredientIds];

  const uncertain = judgment({
    kind: "change",
    confidence: "low",
    metricChanges: [
      {
        metric: "weight",
        unit: "kg",
        baselineDays: 7,
        postDays: 7,
        baselineMean: 80,
        postMean: 79,
        absoluteChange: -1,
        percentChange: -1.25,
        standardizedChange: -0.4,
        magnitude: "small",
        ci95: [-3, 1],
        approximatePValue: 0.2,
        adjustedPValue: 0.4,
        uncertainty: "high",
        direction: "down",
        dataQuality: "low",
        warnings: [],
      },
    ],
  });
  const result = evaluateProducts(input(), [weaker, duplicate, strong], [uncertain], config);

  assert.deepEqual(result.eligible.map((item) => item.product.productId), ["a-strong", "b-weaker"]);
  assert.ok((result.eligible[0]?.score ?? 0) > (result.eligible[1]?.score ?? 0));
  assert.equal(result.eligible[0]?.components?.uncertaintyPenalty, 20);
  assert.ok(
    result.diversityHeld
      .find((item) => item.product.productId === "z-duplicate" && item.constraint === "diversity_hold")
      ?.exclusionReasons.some(({ code }) => code === "DIVERSITY_DUPLICATE"),
  );
});

test("retrieval excludes unsupported categories before filters and gap accounting", () => {
  const protein = product("protein");
  const unrelated = product("sleep-aid");
  unrelated.category = "sleep";
  unrelated.supportedIntentCodes = ["SLEEP_CHANGE"];
  unrelated.facts.labelSourceUrl = undefined;

  const result = evaluateProducts(input(), [unrelated, protein], [judgment()], config);

  assert.deepEqual(result.retrieved.map((item) => item.productId), ["protein"]);
  assert.deepEqual(result.notRetrieved.map((item) => item.productId), ["sleep-aid"]);
  assert.equal(result.excluded.some((item) => item.product.productId === "sleep-aid"), false);
});

test("missing allergen declaration is a hard data-safety exclusion", () => {
  const candidate = product("unknown-allergen-label", {
    allergens: [],
    allergenDeclarationStatus: "missing",
  });
  const result = evaluateProducts(input(), [candidate], [judgment()], config);

  assert.equal(result.eligible.length, 0);
  assert.equal(result.excluded[0]?.constraint, "exclude");
  assert.ok(
    result.excluded[0]?.exclusionReasons.some(
      ({ code }) => code === "ALLERGEN_DECLARATION_MISSING",
    ),
  );
});

test("closed unrelated judgments do not penalize product rank", () => {
  const candidate = product("a");
  const closedModules = [
    judgment({ kind: "compare", confidence: "low", dataQuality: "fail" }),
    judgment({ kind: "plateau", confidence: "low", dataQuality: "fail" }),
    judgment({ kind: "effect", confidence: "low", dataQuality: "fail" }),
  ];
  const result = evaluateProducts(input(), [candidate], closedModules, config);

  assert.equal(result.eligible[0]?.components?.uncertaintyPenalty, 0);
});
