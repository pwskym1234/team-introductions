import type {
  DailyMetricObservation,
  EngineInput,
  EvidenceRef,
  MetricKey,
  ProductCandidate
} from "./types.ts";

const DAY_MS = 86_400_000;
const EVENT_AT = "2026-09-19T09:00:00+09:00";
const AS_OF = "2026-10-03T14:20:00+09:00";

function isoDay(offsetFromEvent: number): string {
  const eventUtc = new Date(EVENT_AT).getTime();
  return new Date(eventUtc + offsetFromEvent * DAY_MS).toISOString().slice(0, 10);
}

function series(
  metric: MetricKey,
  unit: string,
  deviceId: string,
  startOffset: number,
  count: number,
  center: number,
  amplitude: number,
  phase: number,
  completeness = 0.96
): DailyMetricObservation[] {
  return Array.from({ length: count }, (_, index) => ({
    metric,
    date: isoDay(startOffset + index),
    value: Number((center + Math.sin((index + phase) * 1.31) * amplitude + Math.cos((index + phase) * 0.43) * amplitude * 0.35).toFixed(4)),
    unit,
    deviceId,
    completeness,
    synthetic: true
  }));
}

function stableHistory(deviceId = "oura-demo-01"): DailyMetricObservation[] {
  return [
    ...series("resting_heart_rate", "bpm", deviceId, -42, 42, 60, 1.25, 0),
    ...series("resting_heart_rate", "bpm", deviceId, 0, 14, 65, 1.1, 2),
    ...series("sleep_efficiency", "%", deviceId, -42, 42, 86, 1.8, 1),
    ...series("sleep_efficiency", "%", deviceId, 0, 14, 77, 2.1, 3),
    ...series("hrv_rmssd", "ms", deviceId, -42, 42, 48, 4.5, 4),
    ...series("hrv_rmssd", "ms", deviceId, 0, 14, 39, 5.2, 5)
  ];
}

function baseInput(requestId: string): EngineInput {
  return {
    requestId,
    userId: requestId.toLowerCase(),
    asOf: AS_OF,
    timezone: "Asia/Seoul",
    synthetic: true,
    consentScopes: ["service", "brand_aggregate"],
    consentPolicyVersion: "brand-analytics-consent-2026-10-03-v1",
    screening: {
      redFlagSymptoms: "no",
      adultStatus: "adult",
      pregnantOrLactating: "no",
      eatingDisorderConcern: "no",
      allergens: "confirmed_none",
      completedAt: AS_OF
    },
    demographics: { adultConfirmed: true },
    constraints: {
      allergies: [],
      diagnoses: [],
      clinicianDietRestrictions: [],
      dietaryPreferences: [],
      currentSupplements: [],
      budgetKrw: 45_000,
      preferredFormats: ["powder", "ready_to_drink"]
    },
    metrics: stableHistory(),
    medicationEvents: [
      { occurredAt: EVENT_AT, kind: "titration", medicationClass: "glp1", doseLabel: "synthetic-step-2" }
    ],
    symptoms: [],
    nutrition: { proteinMealsPerDay: 1, assessedAt: AS_OF },
    question: {
      text: "증량 뒤 식사량이 줄고 잠도 깨요. 무엇을 먼저 확인하고 어떤 제품을 비교해야 하나요?",
      intentCodes: ["REDUCED_INTAKE", "PROTEIN_SUPPORT", "SLEEP_CHANGE"],
      capturedAt: AS_OF
    },
    confounders: []
  };
}

export function createSyntheticInputs(): EngineInput[] {
  const normal = baseInput("U-01");
  normal.constraints.allergies = ["milk"];
  normal.screening!.allergens = "declared";

  const safety = baseInput("U-02");
  safety.question.text = "배가 심하게 계속 아프고 반복해서 토해요. 마시기 쉬운 쉐이크를 추천해 주세요.";
  safety.question.intentCodes = ["SIDE_EFFECT_CONCERN", "PROTEIN_SUPPORT"];
  safety.symptoms = [
    { code: "severe_persistent_abdominal_pain", severity: "severe", occurredAt: AS_OF },
    { code: "repeated_vomiting", severity: "severe", occurredAt: AS_OF }
  ];

  const insufficient = baseInput("U-03");
  insufficient.question.text = "근손실을 막을 단백질 제품을 골라 주세요. 새 워치는 산 지 5일 됐어요.";
  insufficient.question.intentCodes = ["MUSCLE_LOSS_CONCERN", "PROTEIN_SUPPORT"];
  insufficient.medicationEvents = [
    { occurredAt: EVENT_AT, kind: "maintenance", medicationClass: "glp1", doseLabel: "synthetic-maintenance" }
  ];
  insufficient.metrics = [
    ...series("resting_heart_rate", "bpm", "new-watch-03", 9, 5, 62, 1.5, 1),
    ...series("sleep_efficiency", "%", "new-watch-03", 9, 5, 82, 2.5, 2)
  ];
  insufficient.nutrition.proteinMealsPerDay = 3;

  return [normal, safety, insufficient];
}

function evidence(
  id: string,
  claim: string,
  qualityScore: number,
  populationApplicability: number,
  doseApplicability: number,
  limitations: string[] = []
): EvidenceRef {
  return {
    id,
    claim,
    sourceUrl: `https://example.invalid/evidence/${id}`,
    sourceType: "guideline",
    population: "synthetic adult GLP-1 nutrition demo",
    outcome: "nutrition adequacy and product comparison support",
    limitations,
    reviewedAt: "2026-10-03T09:00:00+09:00",
    qualityScore,
    populationApplicability,
    doseApplicability
  };
}

export function createSyntheticCatalog(): ProductCandidate[] {
  const fresh = "2026-10-02T09:00:00+09:00";
  return [
    {
      productId: "P01",
      name: "합성 유청 분리 단백 A",
      category: "protein",
      supportedIntentCodes: ["REDUCED_INTAKE", "PROTEIN_SUPPORT", "MUSCLE_LOSS_CONCERN"],
      ingredientIds: ["whey_isolate"],
      facts: {
        serving: "30 g",
        ingredientAmounts: { protein_g: 24 },
        allergens: ["milk"],
        allergenDeclarationStatus: "declared",
        contraindicatedDiagnoses: [],
        interactionReviewStatus: "not_applicable",
        officialFunctionClaims: ["protein_supply"],
        priceKrw: 39_900,
        sellerUrl: "https://example.invalid/products/P01",
        stock: "in_stock",
        labelSourceUrl: "https://example.invalid/labels/P01",
        checkedAt: fresh,
        preferredFormats: ["powder"],
        dietaryTags: []
      },
      evidenceRefs: [evidence("E-PROTEIN-01", "식사로 부족한 단백질 보완 선택지", 0.86, 0.82, 0.9)],
      synthetic: true
    },
    {
      productId: "P03",
      name: "합성 대두 분리 단백 C",
      category: "protein",
      supportedIntentCodes: ["REDUCED_INTAKE", "PROTEIN_SUPPORT", "MUSCLE_LOSS_CONCERN"],
      ingredientIds: ["soy_isolate"],
      facts: {
        serving: "32 g",
        ingredientAmounts: { protein_g: 23 },
        allergens: ["soy"],
        allergenDeclarationStatus: "declared",
        contraindicatedDiagnoses: [],
        interactionReviewStatus: "not_applicable",
        officialFunctionClaims: ["protein_supply"],
        priceKrw: 34_900,
        sellerUrl: "https://example.invalid/products/P03",
        stock: "in_stock",
        labelSourceUrl: "https://example.invalid/labels/P03",
        checkedAt: fresh,
        preferredFormats: ["powder"],
        dietaryTags: ["plant_based"]
      },
      evidenceRefs: [evidence("E-PROTEIN-03", "식물성 단백질 보완 선택지", 0.82, 0.86, 0.88)],
      synthetic: true
    },
    {
      productId: "P04",
      name: "합성 완두 단백 D",
      category: "protein",
      supportedIntentCodes: ["REDUCED_INTAKE", "PROTEIN_SUPPORT", "MUSCLE_LOSS_CONCERN"],
      ingredientIds: ["pea_protein"],
      facts: {
        serving: "31 g",
        ingredientAmounts: { protein_g: 22 },
        allergens: [],
        allergenDeclarationStatus: "confirmed_none",
        contraindicatedDiagnoses: [],
        interactionReviewStatus: "not_applicable",
        officialFunctionClaims: ["protein_supply"],
        priceKrw: 36_900,
        sellerUrl: "https://example.invalid/products/P04",
        stock: "in_stock",
        labelSourceUrl: "https://example.invalid/labels/P04",
        checkedAt: fresh,
        preferredFormats: ["powder"],
        dietaryTags: ["plant_based"]
      },
      evidenceRefs: [evidence("E-PROTEIN-04", "식물성 단백질 보완 선택지", 0.88, 0.88, 0.91)],
      synthetic: true
    },
    {
      productId: "P05",
      name: "합성 혼합 식물 단백 E",
      category: "protein",
      supportedIntentCodes: ["REDUCED_INTAKE", "PROTEIN_SUPPORT", "MUSCLE_LOSS_CONCERN"],
      ingredientIds: ["pea_protein", "rice_protein"],
      facts: {
        serving: "30 g",
        ingredientAmounts: { protein_g: 21 },
        allergens: [],
        allergenDeclarationStatus: "confirmed_none",
        contraindicatedDiagnoses: [],
        interactionReviewStatus: "not_applicable",
        officialFunctionClaims: ["protein_supply"],
        priceKrw: 42_900,
        sellerUrl: "https://example.invalid/products/P05",
        stock: "unknown",
        labelSourceUrl: "https://example.invalid/labels/P05",
        checkedAt: "2026-07-01T09:00:00+09:00",
        preferredFormats: ["powder"],
        dietaryTags: ["plant_based"]
      },
      evidenceRefs: [evidence("E-PROTEIN-05", "혼합 식물 단백질 보완 선택지", 0.7, 0.75, 0.65, ["제품 함량 출처가 오래됨"])],
      synthetic: true
    },
    {
      productId: "P08",
      name: "합성 다성분 식사대용 H",
      category: "meal_replacement",
      supportedIntentCodes: ["REDUCED_INTAKE", "PROTEIN_SUPPORT"],
      ingredientIds: ["pea_protein", "fiber_blend", "mineral_blend"],
      facts: {
        serving: "1 pouch",
        ingredientAmounts: { protein_g: 18 },
        allergens: [],
        allergenDeclarationStatus: "confirmed_none",
        contraindicatedDiagnoses: [],
        clinicianReviewRequired: true,
        interactionReviewStatus: "unverified",
        officialFunctionClaims: [],
        priceKrw: 4_900,
        sellerUrl: "https://example.invalid/products/P08",
        stock: "in_stock",
        labelSourceUrl: "https://example.invalid/labels/P08",
        checkedAt: fresh,
        preferredFormats: ["ready_to_drink"],
        dietaryTags: ["plant_based"]
      },
      evidenceRefs: [evidence("E-MEAL-08", "다성분 식사대용은 개별 검토 필요", 0.55, 0.55, 0.5, ["상호작용 검토 미완료"])],
      synthetic: true
    },
    {
      productId: "P09",
      name: "합성 종합비타민 I",
      category: "multivitamin",
      supportedIntentCodes: ["MICRONUTRIENT_SUPPORT"],
      ingredientIds: ["multivitamin_blend"],
      facts: {
        allergens: [],
        allergenDeclarationStatus: "confirmed_none",
        contraindicatedDiagnoses: [],
        interactionReviewStatus: "unverified",
        officialFunctionClaims: [],
        priceKrw: 24_900,
        sellerUrl: "https://example.invalid/products/P09",
        stock: "in_stock",
        checkedAt: fresh,
        preferredFormats: ["tablet"],
        dietaryTags: []
      },
      evidenceRefs: [],
      synthetic: true
    }
  ];
}
