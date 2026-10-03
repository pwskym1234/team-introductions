export type IsoDate = string;
export type IsoDateTime = string;

export type MetricKey =
  | "resting_heart_rate"
  | "hrv_rmssd"
  | "sleep_efficiency"
  | "total_sleep_minutes"
  | "steps"
  | "weight"
  | "respiratory_rate";

export interface DailyMetricObservation {
  metric: MetricKey;
  date: IsoDate;
  value: number;
  unit: string;
  deviceId: string;
  completeness: number;
  synthetic: boolean;
}

export interface MedicationEvent {
  occurredAt: IsoDateTime;
  kind: "start" | "titration" | "maintenance" | "stop";
  medicationClass: "glp1" | "other" | "unknown";
  doseLabel?: string;
}

export interface SymptomInput {
  code: string;
  severity: "mild" | "moderate" | "severe";
  occurredAt: IsoDateTime;
}

export type TriState = "yes" | "no" | "unknown";
export type AdultScreeningState = "adult" | "minor" | "unknown";
export type AllergenScreeningState = "declared" | "confirmed_none" | "unknown";

/**
 * Explicit screening state. Empty arrays and omitted booleans must never be
 * interpreted as a completed negative screen. Older callers may omit this
 * object, but the engine then treats every gate as unknown and asks before it
 * evaluates products.
 */
export interface ScreeningInput {
  redFlagSymptoms: TriState;
  adultStatus: AdultScreeningState;
  pregnantOrLactating: TriState;
  eatingDisorderConcern: TriState;
  allergens: AllergenScreeningState;
  completedAt?: IsoDateTime;
}

export interface EngineInput {
  requestId: string;
  userId: string;
  asOf: IsoDateTime;
  timezone: string;
  synthetic: boolean;
  consentScopes: Array<"service" | "engine_improvement" | "research" | "brand_aggregate" | "marketing">;
  /** The exact policy presented when the scopes above were granted. */
  consentPolicyVersion?: string;
  screening?: ScreeningInput;
  demographics: {
    adultConfirmed: boolean;
    pregnantOrLactating?: boolean;
    suspectedEatingDisorder?: boolean;
  };
  constraints: {
    allergies: string[];
    diagnoses: string[];
    clinicianDietRestrictions: string[];
    dietaryPreferences: string[];
    currentSupplements: string[];
    budgetKrw?: number;
    preferredFormats?: string[];
  };
  metrics: DailyMetricObservation[];
  medicationEvents: MedicationEvent[];
  symptoms: SymptomInput[];
  nutrition: {
    proteinMealsPerDay?: number;
    estimatedProteinGPerDay?: number;
    assessedAt?: IsoDateTime;
  };
  question: {
    text: string;
    intentCodes: string[];
    capturedAt: IsoDateTime;
  };
  confounders?: string[];
  cohortComparisonApproved?: boolean;
  nof1ProtocolApproved?: boolean;
}

export interface EvidenceRef {
  id: string;
  claim: string;
  sourceUrl: string;
  sourceType: "official_label" | "guideline" | "systematic_review" | "rct" | "observational";
  population: string;
  doseOrExposure?: string;
  outcome: string;
  limitations: string[];
  reviewedAt: IsoDateTime;
  qualityScore: number;
  populationApplicability: number;
  doseApplicability: number;
}

export interface ProductCandidate {
  productId: string;
  name: string;
  category: string;
  /** Controlled intent codes for which this product may enter retrieval. */
  supportedIntentCodes?: string[];
  ingredientIds: string[];
  facts: {
    serving?: string;
    ingredientAmounts?: Record<string, number>;
    allergens: string[];
    /** Distinguishes a verified "none" declaration from missing label data. */
    allergenDeclarationStatus?: "declared" | "confirmed_none" | "missing";
    contraindicatedDiagnoses: string[];
    clinicianReviewRequired?: boolean;
    interactionReviewStatus: "cleared" | "unverified" | "not_applicable";
    officialFunctionClaims: string[];
    priceKrw?: number;
    sellerUrl?: string;
    stock: "in_stock" | "out_of_stock" | "unknown";
    labelSourceUrl?: string;
    checkedAt?: IsoDateTime;
    preferredFormats?: string[];
    dietaryTags?: string[];
  };
  evidenceRefs: EvidenceRef[];
  synthetic: boolean;
}

export type DataQuality = "pass" | "low" | "fail";

export interface MetricChangeAnalysis {
  metric: MetricKey;
  unit: string;
  baselineDays: number;
  postDays: number;
  baselineMean: number | null;
  postMean: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  standardizedChange: number | null;
  magnitude: "none" | "small" | "moderate" | "large" | "unknown";
  ci95: [number, number] | null;
  approximatePValue: number | null;
  adjustedPValue: number | null;
  uncertainty: "low" | "moderate" | "high";
  direction: "up" | "down" | "flat" | "unknown";
  dataQuality: DataQuality;
  warnings: string[];
}

export type JudgmentKind = "change" | "cause" | "risk" | "compare" | "plateau" | "effect";
export type JudgmentStatus =
  | "insufficient_data"
  | "no_clear_change"
  | "observable_change"
  | "temporally_associated"
  | "confounded"
  | "no_red_flag_detected"
  | "safety_unknown"
  | "safety_escalation"
  | "comparison_unavailable"
  | "plateau_unavailable"
  | "research_not_approved"
  | "eligible";

export interface FourSlotExplanation {
  observation: string[];
  possibleInterpretation: string[];
  unknown: string[];
  nextAction: string[];
}

export interface JudgmentResult {
  kind: JudgmentKind;
  status: JudgmentStatus;
  confidence: "low" | "moderate" | "high";
  metricChanges: MetricChangeAnalysis[];
  explanation: FourSlotExplanation;
  dataQuality: DataQuality;
  reasonCodes: string[];
  computedAt: IsoDateTime;
}

export type ConstraintDecision = "pass" | "exclude" | "expert_review" | "diversity_hold";

export interface CandidateEvaluation {
  product: ProductCandidate;
  constraint: ConstraintDecision;
  exclusionReasons: Array<{ code: string; explanation: string; fieldRef?: string }>;
  components?: {
    evidenceQuality: number;
    personalFit: number;
    productDataQuality: number;
    feasibilityPreference: number;
    uncertaintyPenalty: number;
  };
  score?: number;
}

export interface ClarificationRequest {
  field: string;
  code: string;
  question: string;
  why: string;
  priorityScore: number;
  safetyGate: boolean;
}

export type DecisionDisposition =
  | "safety_stop"
  | "medication_boundary"
  | "ask_clarification"
  | "insufficient_data"
  | "recommend_food_first"
  | "show_eligible_products"
  | "clinical_consult"
  | "abstain";

export interface EngineEvent {
  eventId: string;
  eventName: string;
  occurredAt: IsoDateTime;
  eventSequence: number;
  journeyId: string;
  anonymousUserId: string;
  anonymousSessionId: string;
  scenarioId: string;
  requestScope: "brand_aggregate";
  consentPolicyVersion: string;
  synthetic: boolean;
  intentCode?: string;
  verdictCode?: string;
  productId?: string;
  reasonCode?: string;
  engineVersion: string;
  ruleVersion: string;
  evidenceVersion: string;
}

export interface EngineDecision {
  requestId: string;
  disposition: DecisionDisposition;
  judgments: JudgmentResult[];
  eligible: CandidateEvaluation[];
  excluded: CandidateEvaluation[];
  explanation: FourSlotExplanation;
  missingFields: string[];
  nextClarification: ClarificationRequest | null;
  retrieval: {
    catalogCount: number;
    retrievedCount: number;
    notRetrievedCount: number;
    intentCodes: string[];
  };
  analyticsEmission: "allowed" | "scope_missing" | "policy_version_mismatch";
  events: EngineEvent[];
  versions: {
    engine: string;
    rules: string;
    evidenceSnapshot: string;
    productSnapshot: string;
  };
  generatedAt: IsoDateTime;
  synthetic: boolean;
}

export interface EngineConfig {
  engineVersion: string;
  ruleVersion: string;
  evidenceSnapshot: string;
  productSnapshot: string;
  consentPolicyVersion: string;
  baselineMinDays: number;
  postMinDays: number;
  completenessPass: number;
  completenessFail: number;
  labelFreshnessDays: number;
  familyAlpha: number;
}

export interface BrandAggregate {
  synthetic: boolean;
  generatedAt: IsoDateTime;
  funnel: Array<{ stage: string; count: number; denominator: number | null }>;
  verdicts: Array<{ code: string; count: number }>;
  exclusions: Array<{ reasonCode: string; count: number }>;
  productGaps: Array<{
    productId: string;
    candidateCount: number;
    eligibleCount: number;
    excludedCount: number;
    topReasons: Array<{ reasonCode: string; count: number }>;
  }>;
}
