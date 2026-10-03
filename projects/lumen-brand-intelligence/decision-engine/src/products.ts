import type {
  CandidateEvaluation,
  EngineConfig,
  EngineInput,
  JudgmentResult,
  ProductCandidate,
} from "./types.ts";

export type ProductReasonCode =
  | "RED_FLAG_PRESENT"
  | "EXCLUDED_POPULATION"
  | "PREGNANCY_LACTATION_REVIEW"
  | "EATING_DISORDER_REVIEW"
  | "ALLERGEN_MATCH"
  | "ALLERGEN_DECLARATION_MISSING"
  | "CONTRAINDICATED_DIAGNOSIS"
  | "CLINICIAN_RESTRICTION"
  | "CLINICIAN_REVIEW_REQUIRED"
  | "INTERACTION_UNVERIFIED"
  | "INGREDIENT_DUPLICATE"
  | "LABEL_MISSING"
  | "EVIDENCE_MISSING"
  | "PRICE_MISSING"
  | "DATA_FRESHNESS_MISSING"
  | "PRODUCT_DATA_STALE"
  | "OUT_OF_STOCK"
  | "STOCK_UNKNOWN"
  | "INSUFFICIENT_DECISION_CONTEXT"
  | "DIVERSITY_DUPLICATE";

export interface ProductEvaluationResult {
  /** Products selected by explicit intent support before safety filtering. */
  retrieved: ProductCandidate[];
  /** Products outside the request intent; never emitted as candidates or gaps. */
  notRetrieved: ProductCandidate[];
  eligible: CandidateEvaluation[];
  /** Every candidate that cannot be shown, including expert-review holds. */
  excluded: CandidateEvaluation[];
  /** Convenience view over the expert-review entries also present in excluded. */
  expertReview: CandidateEvaluation[];
  /** Ranking-stage suppression, deliberately separate from safety exclusions. */
  diversityHeld: CandidateEvaluation[];
}

type EvaluationReason = CandidateEvaluation["exclusionReasons"][number];

const DAY_MS = 24 * 60 * 60 * 1_000;

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s_-]+/g, " ");
}

function bounded(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function score100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return bounded(value <= 1 ? value * 100 : value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function textMatches(a: string, b: string): boolean {
  const left = normalize(a);
  const right = normalize(b);
  return left.length > 0 && right.length > 0 && (left === right || left.includes(right) || right.includes(left));
}

function overlaps(left: string[], right: string[]): Array<[string, string]> {
  const matches: Array<[string, string]> = [];
  for (const a of left) {
    for (const b of right) {
      if (textMatches(a, b)) matches.push([a, b]);
    }
  }
  return matches;
}

/** Intent retrieval is explicit: category names and marketing copy are not proxies. */
export function retrieveProducts(
  input: EngineInput,
  catalog: ProductCandidate[],
): { retrieved: ProductCandidate[]; notRetrieved: ProductCandidate[] } {
  const requested = new Set(input.question.intentCodes.map(normalize));
  const retrieved: ProductCandidate[] = [];
  const notRetrieved: ProductCandidate[] = [];
  for (const product of catalog) {
    const supported = product.supportedIntentCodes ?? [];
    const matches = supported.some((intent) => requested.has(normalize(intent)));
    (matches ? retrieved : notRetrieved).push(product);
  }
  return { retrieved, notRetrieved };
}

function reason(code: ProductReasonCode, explanation: string, fieldRef?: string): EvaluationReason {
  return { code, explanation, ...(fieldRef ? { fieldRef } : {}) };
}

function productDescriptors(product: ProductCandidate): string[] {
  return [
    product.name,
    product.category,
    ...product.ingredientIds,
    ...(product.facts.dietaryTags ?? []),
    ...product.facts.officialFunctionClaims,
  ];
}

function globalConstraints(input: EngineInput, judgments: JudgmentResult[]): {
  exclude: EvaluationReason[];
  review: EvaluationReason[];
} {
  const exclude: EvaluationReason[] = [];
  const review: EvaluationReason[] = [];

  if (judgments.some((judgment) => judgment.kind === "risk" && judgment.status === "safety_escalation")) {
    exclude.push(
      reason(
        "RED_FLAG_PRESENT",
        "안전 위험 신호가 확인되어 상품 연결을 중단합니다.",
        "judgments.risk",
      ),
    );
  }
  if (!input.demographics.adultConfirmed) {
    exclude.push(
      reason(
        "EXCLUDED_POPULATION",
        "성인임이 확인되지 않아 성인용 상품을 연결하지 않습니다.",
        "demographics.adultConfirmed",
      ),
    );
  }
  if (input.demographics.pregnantOrLactating) {
    review.push(
      reason(
        "PREGNANCY_LACTATION_REVIEW",
        "임신·수유 중에는 상품 연결 전 전문가 검토가 필요합니다.",
        "demographics.pregnantOrLactating",
      ),
    );
  }
  if (input.demographics.suspectedEatingDisorder) {
    review.push(
      reason(
        "EATING_DISORDER_REVIEW",
        "섭식장애 위험이 의심되어 자동 상품 연결 대신 전문가 검토가 필요합니다.",
        "demographics.suspectedEatingDisorder",
      ),
    );
  }
  if (input.question.intentCodes.length === 0 || judgments.length === 0) {
    review.push(
      reason(
        "INSUFFICIENT_DECISION_CONTEXT",
        "상품 적격성을 판단할 의도 또는 선행 판정 정보가 부족합니다.",
        input.question.intentCodes.length === 0 ? "question.intentCodes" : "judgments",
      ),
    );
  }

  return { exclude, review };
}

function productConstraints(
  input: EngineInput,
  product: ProductCandidate,
  config: EngineConfig,
): { exclude: EvaluationReason[]; review: EvaluationReason[] } {
  const exclude: EvaluationReason[] = [];
  const review: EvaluationReason[] = [];

  const declaration = product.facts.allergenDeclarationStatus;
  const declarationIsConsistent =
    (declaration === "declared" && product.facts.allergens.length > 0) ||
    (declaration === "confirmed_none" && product.facts.allergens.length === 0);
  if (!declarationIsConsistent) {
    exclude.push(
      reason(
        "ALLERGEN_DECLARATION_MISSING",
        "알레르기 표시가 '없음 확인' 또는 표시 원료 목록으로 검증되지 않았습니다.",
        "facts.allergenDeclarationStatus",
      ),
    );
  }

  for (const [allergy, matched] of overlaps(input.constraints.allergies, product.facts.allergens)) {
    exclude.push(
      reason("ALLERGEN_MATCH", `알레르기 '${allergy}'와 상품 표시 '${matched}'가 일치합니다.`, "facts.allergens"),
    );
  }

  for (const [diagnosis, matched] of overlaps(
    input.constraints.diagnoses,
    product.facts.contraindicatedDiagnoses,
  )) {
    exclude.push(
      reason(
        "CONTRAINDICATED_DIAGNOSIS",
        `진단 '${diagnosis}'이 상품 금기 '${matched}'에 해당합니다.`,
        "facts.contraindicatedDiagnoses",
      ),
    );
  }

  for (const [restriction, matched] of overlaps(
    input.constraints.clinicianDietRestrictions,
    productDescriptors(product),
  )) {
    exclude.push(
      reason(
        "CLINICIAN_RESTRICTION",
        `의료진 제한 '${restriction}'과 상품 정보 '${matched}'가 충돌합니다.`,
        "constraints.clinicianDietRestrictions",
      ),
    );
  }

  if (product.facts.clinicianReviewRequired) {
    review.push(
      reason(
        "CLINICIAN_REVIEW_REQUIRED",
        "상품 라벨이 의료진 검토를 요구합니다.",
        "facts.clinicianReviewRequired",
      ),
    );
  }
  if (product.facts.interactionReviewStatus === "unverified") {
    review.push(
      reason(
        "INTERACTION_UNVERIFIED",
        "현재 치료·섭취 정보와의 상호작용이 검증되지 않았습니다.",
        "facts.interactionReviewStatus",
      ),
    );
  }

  for (const [current, matched] of overlaps(input.constraints.currentSupplements, [
    ...product.ingredientIds,
    product.name,
  ])) {
    exclude.push(
      reason(
        "INGREDIENT_DUPLICATE",
        `현재 섭취 중인 '${current}'와 상품 성분 '${matched}'가 중복됩니다.`,
        "ingredientIds",
      ),
    );
  }

  if (!product.facts.labelSourceUrl) {
    exclude.push(reason("LABEL_MISSING", "확인 가능한 공식 라벨 출처가 없습니다.", "facts.labelSourceUrl"));
  }
  if (
    product.evidenceRefs.length === 0 ||
    product.evidenceRefs.every((evidence) => !evidence.sourceUrl || evidence.qualityScore <= 0)
  ) {
    exclude.push(reason("EVIDENCE_MISSING", "평가에 사용할 수 있는 근거 출처가 없습니다.", "evidenceRefs"));
  }
  if (product.facts.priceKrw === undefined || !Number.isFinite(product.facts.priceKrw)) {
    exclude.push(reason("PRICE_MISSING", "가격 정보가 없어 실제 연결 가능성을 확인할 수 없습니다.", "facts.priceKrw"));
  }
  if (!product.facts.checkedAt) {
    exclude.push(
      reason("DATA_FRESHNESS_MISSING", "가격·재고 확인 시점이 기록되지 않았습니다.", "facts.checkedAt"),
    );
  } else {
    const checkedAt = Date.parse(product.facts.checkedAt);
    const asOf = Date.parse(input.asOf);
    const ageDays = (asOf - checkedAt) / DAY_MS;
    if (!Number.isFinite(checkedAt) || !Number.isFinite(asOf) || ageDays < 0) {
      review.push(
        reason(
          "DATA_FRESHNESS_MISSING",
          "가격·재고 확인 시점이 유효하지 않아 전문가 확인이 필요합니다.",
          "facts.checkedAt",
        ),
      );
    } else if (ageDays > config.labelFreshnessDays) {
      exclude.push(
        reason(
          "PRODUCT_DATA_STALE",
          `가격·재고 정보가 ${Math.floor(ageDays)}일 전 자료로 허용 기한을 넘었습니다.`,
          "facts.checkedAt",
        ),
      );
    }
  }

  if (product.facts.stock === "out_of_stock") {
    exclude.push(reason("OUT_OF_STOCK", "현재 재고가 없어 연결 대상에서 제외합니다.", "facts.stock"));
  } else if (product.facts.stock === "unknown") {
    exclude.push(reason("STOCK_UNKNOWN", "재고 상태를 확인할 수 없습니다.", "facts.stock"));
  }

  return { exclude, review };
}

function evidenceQuality(product: ProductCandidate): number {
  if (product.evidenceRefs.length === 0) return 0;
  const total = product.evidenceRefs.reduce((sum, evidence) => {
    return (
      sum +
      score100(evidence.qualityScore) * 0.5 +
      score100(evidence.populationApplicability) * 0.3 +
      score100(evidence.doseApplicability) * 0.2
    );
  }, 0);
  return round2(total / product.evidenceRefs.length);
}

function personalFit(input: EngineInput, product: ProductCandidate): number {
  let score = 70;
  const preferenceMatches = overlaps(input.constraints.dietaryPreferences, product.facts.dietaryTags ?? []).length;
  score += Math.min(15, preferenceMatches * 7.5);

  const formatMatches = overlaps(input.constraints.preferredFormats ?? [], product.facts.preferredFormats ?? []).length;
  if ((input.constraints.preferredFormats?.length ?? 0) > 0) score += formatMatches > 0 ? 10 : -10;

  const intentText = [...input.question.intentCodes, input.question.text];
  if (overlaps(intentText, [product.category, ...product.facts.officialFunctionClaims]).length > 0) score += 5;
  return round2(bounded(score));
}

function productDataQuality(product: ProductCandidate): number {
  const checks = [
    Boolean(product.facts.serving),
    Boolean(product.facts.ingredientAmounts && Object.keys(product.facts.ingredientAmounts).length > 0),
    (product.facts.allergenDeclarationStatus === "declared" && product.facts.allergens.length > 0) ||
      (product.facts.allergenDeclarationStatus === "confirmed_none" && product.facts.allergens.length === 0),
    product.facts.officialFunctionClaims.length > 0,
    product.facts.priceKrw !== undefined,
    Boolean(product.facts.sellerUrl),
    Boolean(product.facts.labelSourceUrl),
    Boolean(product.facts.checkedAt),
    product.evidenceRefs.length > 0,
    product.facts.stock === "in_stock",
  ];
  return round2((checks.filter(Boolean).length / checks.length) * 100);
}

function feasibility(input: EngineInput, product: ProductCandidate): number {
  let score = 50;
  if (product.facts.stock === "in_stock") score += 25;

  if (input.constraints.budgetKrw !== undefined && product.facts.priceKrw !== undefined) {
    score += product.facts.priceKrw <= input.constraints.budgetKrw ? 15 : -25;
  } else {
    score += 5;
  }

  const preferences = input.constraints.preferredFormats ?? [];
  if (preferences.length === 0) score += 5;
  else if (overlaps(preferences, product.facts.preferredFormats ?? []).length > 0) score += 10;

  return round2(bounded(score));
}

function uncertaintyPenalty(product: ProductCandidate, judgments: JudgmentResult[]): number {
  let penalty = 0;
  // Closed research/cohort/plateau modules are not evidence about this product.
  // Only the personal change and temporal-cause judgments influence ranking.
  const relevantJudgments = judgments.filter(
    (judgment) => judgment.kind === "change" || judgment.kind === "cause",
  );
  for (const judgment of relevantJudgments) {
    penalty = Math.max(penalty, judgment.confidence === "low" ? 10 : judgment.confidence === "moderate" ? 5 : 0);
    penalty = Math.max(penalty, judgment.dataQuality === "fail" ? 15 : judgment.dataQuality === "low" ? 8 : 0);
    for (const metric of judgment.metricChanges) {
      penalty = Math.max(penalty, metric.uncertainty === "high" ? 20 : metric.uncertainty === "moderate" ? 10 : 0);
    }
  }

  const limitations = product.evidenceRefs.reduce((count, evidence) => count + evidence.limitations.length, 0);
  penalty += Math.min(10, limitations * 2);
  return round2(bounded(penalty, 0, 30));
}

function scoreCandidate(
  input: EngineInput,
  product: ProductCandidate,
  judgments: JudgmentResult[],
): CandidateEvaluation {
  const components = {
    evidenceQuality: evidenceQuality(product),
    personalFit: personalFit(input, product),
    productDataQuality: productDataQuality(product),
    feasibilityPreference: feasibility(input, product),
    uncertaintyPenalty: uncertaintyPenalty(product, judgments),
  };
  const score = round2(
    bounded(
      components.evidenceQuality * 0.4 +
        components.personalFit * 0.3 +
        components.productDataQuality * 0.2 +
        components.feasibilityPreference * 0.1 -
        components.uncertaintyPenalty,
    ),
  );

  return { product, constraint: "pass", exclusionReasons: [], components, score };
}

function diversityKey(product: ProductCandidate): string {
  const ingredients = [...new Set(product.ingredientIds.map(normalize))].sort();
  return `${normalize(product.category)}::${ingredients.join("|")}`;
}

/**
 * Product safety and ranking pipeline. All hard constraints run before any
 * candidate is scored. Advertising spend, sponsorship and click propensity
 * are intentionally absent from both the inputs and scoring formula.
 */
export function evaluateProducts(
  input: EngineInput,
  catalog: ProductCandidate[],
  judgments: JudgmentResult[],
  config: EngineConfig,
): ProductEvaluationResult {
  const { retrieved, notRetrieved } = retrieveProducts(input, catalog);
  const eligibleForScoring: ProductCandidate[] = [];
  const excluded: CandidateEvaluation[] = [];
  const expertReview: CandidateEvaluation[] = [];
  const diversityHeld: CandidateEvaluation[] = [];
  const global = globalConstraints(input, judgments);

  for (const product of retrieved) {
    const local = productConstraints(input, product, config);
    const exclusionReasons = [...global.exclude, ...local.exclude];
    const reviewReasons = [...global.review, ...local.review];

    if (exclusionReasons.length > 0) {
      excluded.push({ product, constraint: "exclude", exclusionReasons: [...exclusionReasons, ...reviewReasons] });
    } else if (reviewReasons.length > 0) {
      const held = { product, constraint: "expert_review" as const, exclusionReasons: reviewReasons };
      expertReview.push(held);
      excluded.push(held);
    } else {
      eligibleForScoring.push(product);
    }
  }

  const ranked = eligibleForScoring.map((product) => scoreCandidate(input, product, judgments)).sort((a, b) => {
    const scoreDifference = (b.score ?? 0) - (a.score ?? 0);
    return scoreDifference !== 0 ? scoreDifference : a.product.productId.localeCompare(b.product.productId);
  });

  const eligible: CandidateEvaluation[] = [];
  const seenDiversityKeys = new Map<string, string>();
  for (const candidate of ranked) {
    const key = diversityKey(candidate.product);
    const retainedProductId = seenDiversityKeys.get(key);
    if (retainedProductId) {
      const held: CandidateEvaluation = {
        product: candidate.product,
        constraint: "diversity_hold",
        exclusionReasons: [
          reason(
            "DIVERSITY_DUPLICATE",
            `동일 카테고리·성분 구성의 상위 상품 '${retainedProductId}'이 이미 포함되었습니다.`,
            "ingredientIds",
          ),
        ],
      };
      diversityHeld.push(held);
      excluded.push(held);
    } else {
      seenDiversityKeys.set(key, candidate.product.productId);
      eligible.push(candidate);
    }
  }

  excluded.sort((a, b) => a.product.productId.localeCompare(b.product.productId));
  expertReview.sort((a, b) => a.product.productId.localeCompare(b.product.productId));
  diversityHeld.sort((a, b) => a.product.productId.localeCompare(b.product.productId));
  return { retrieved, notRetrieved, eligible, excluded, expertReview, diversityHeld };
}
