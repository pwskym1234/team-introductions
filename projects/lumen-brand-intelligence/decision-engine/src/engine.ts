import { createHash } from "node:crypto";
import { DEFAULT_ENGINE_CONFIG } from "./config.ts";
import { analyzeMetricChanges } from "./statistics.ts";
import { createEngineEvent, type EngineEventName } from "./analytics.ts";
import { evaluateProducts, retrieveProducts } from "./products.ts";
import type {
  CandidateEvaluation,
  ClarificationRequest,
  DataQuality,
  DecisionDisposition,
  EngineConfig,
  EngineDecision,
  EngineEvent,
  EngineInput,
  FourSlotExplanation,
  JudgmentResult,
  MetricChangeAnalysis,
  ProductCandidate
} from "./types.ts";

const RED_FLAG_CODES = new Set([
  "severe_persistent_abdominal_pain",
  "repeated_vomiting",
  "unable_to_keep_fluids",
  "loss_of_consciousness",
  "difficulty_breathing",
  "severe_dehydration"
]);

const MEDICATION_BOUNDARY_PATTERNS = [
  /용량.*(올려|내려|줄여|늘려)/i,
  /(증량|감량|중단)\s*(을|를)?\s*(해야|해도|할까|해줘|해주세요)/i,
  /(위고비|마운자로|오젬픽).*(바꿔|갈아타|더 안전|더 좋아)/i,
  /(which|switch|change).*(drug|dose|medication)/i
];

function nowFromInput(input: EngineInput): string {
  return input.asOf;
}

function qualityRank(value: DataQuality): number {
  return value === "pass" ? 2 : value === "low" ? 1 : 0;
}

function overallQuality(changes: MetricChangeAnalysis[]): DataQuality {
  if (changes.length === 0) return "fail";
  // A good metric must not hide another metric that failed comparability or
  // coverage. Consumers can still inspect per-metric quality below.
  const worst = Math.min(...changes.map((change) => qualityRank(change.dataQuality)));
  return worst === 2 ? "pass" : worst === 1 ? "low" : "fail";
}

interface SafetyAssessment {
  escalationCodes: string[];
  unknownFields: string[];
}

function assessSafety(input: EngineInput): SafetyAssessment {
  const escalationCodes: string[] = [];
  const unknownFields: string[] = [];
  const screen = input.screening;
  const symptomRedFlags = input.symptoms.filter(
    (symptom) => symptom.severity === "severe" || RED_FLAG_CODES.has(symptom.code),
  );

  if (symptomRedFlags.length > 0 || screen?.redFlagSymptoms === "yes") {
    escalationCodes.push(
      ...(symptomRedFlags.length > 0
        ? symptomRedFlags.map((item) => `RED_FLAG_${item.code.toUpperCase()}`)
        : ["RED_FLAG_SCREEN_POSITIVE"]),
    );
  } else if (!screen || screen.redFlagSymptoms === "unknown") {
    unknownFields.push("screening.redFlagSymptoms");
  }

  if (!input.demographics.adultConfirmed || screen?.adultStatus === "minor") {
    escalationCodes.push("PROTECTED_POPULATION_MINOR_OR_NOT_ADULT");
  } else if (!screen || screen.adultStatus === "unknown") {
    unknownFields.push("screening.adultStatus");
  }

  if (input.demographics.pregnantOrLactating === true || screen?.pregnantOrLactating === "yes") {
    escalationCodes.push("PROTECTED_POPULATION_PREGNANCY_LACTATION");
  } else if (!screen || screen.pregnantOrLactating === "unknown") {
    unknownFields.push("screening.pregnantOrLactating");
  }

  if (input.demographics.suspectedEatingDisorder === true || screen?.eatingDisorderConcern === "yes") {
    escalationCodes.push("PROTECTED_POPULATION_EATING_DISORDER_CONCERN");
  } else if (!screen || screen.eatingDisorderConcern === "unknown") {
    unknownFields.push("screening.eatingDisorderConcern");
  }

  if (!screen || screen.allergens === "unknown" ||
      (screen.allergens === "declared" && input.constraints.allergies.length === 0)) {
    unknownFields.push("screening.allergens");
  }

  return {
    escalationCodes: [...new Set(escalationCodes)],
    unknownFields: [...new Set(unknownFields)],
  };
}

function blankExplanation(): FourSlotExplanation {
  return { observation: [], possibleInterpretation: [], unknown: [], nextAction: [] };
}

function judgment(
  input: EngineInput,
  partial: Omit<JudgmentResult, "computedAt">
): JudgmentResult {
  return { ...partial, computedAt: nowFromInput(input) };
}

function buildSixJudgments(input: EngineInput, changes: MetricChangeAnalysis[]): JudgmentResult[] {
  const dataQuality = overallQuality(changes);
  const usable = changes.filter((change) => change.dataQuality !== "fail");
  const clear = usable.filter(
    (change) => change.magnitude !== "none" && change.magnitude !== "unknown" && change.uncertainty !== "high"
  );
  const changeExplanation = blankExplanation();

  if (usable.length === 0) {
    changeExplanation.observation.push("같은 기기의 충분한 기준선과 이후 자료가 없어 변화를 계산하지 못했습니다.");
    changeExplanation.unknown.push("현재 값이 평소 범위에서 벗어났는지는 아직 모릅니다.");
    changeExplanation.nextAction.push("같은 기기로 4~6주 기준선을 확보한 뒤 다시 계산합니다.");
  } else {
    for (const metric of usable) {
      const sign = metric.direction === "up" ? "증가" : metric.direction === "down" ? "감소" : "변화 없음";
      if (metric.absoluteChange !== null) {
        changeExplanation.observation.push(
          `${metric.metric} 평균이 기준선 대비 ${Math.abs(metric.absoluteChange).toFixed(2)}${metric.unit} ${sign}했습니다.`
        );
      }
      if (metric.uncertainty === "high") {
        changeExplanation.unknown.push(`${metric.metric}은 불확실성 구간이 넓어 변화 방향을 확정하지 않습니다.`);
      }
    }
    changeExplanation.possibleInterpretation.push("이는 개인 기준선 대비 변화 크기이며 임상적 위험이나 원인을 뜻하지 않습니다.");
    changeExplanation.nextAction.push("같은 기기와 같은 시간대의 추가 관찰로 변화가 지속되는지 확인합니다.");
  }

  const changeJudgment = judgment(input, {
    kind: "change",
    status: usable.length === 0 ? "insufficient_data" : clear.length > 0 ? "observable_change" : "no_clear_change",
    confidence: dataQuality === "pass" && clear.length > 0 ? "moderate" : "low",
    metricChanges: changes,
    explanation: changeExplanation,
    dataQuality,
    reasonCodes: usable.length === 0 ? ["BASELINE_OR_POST_WINDOW_INSUFFICIENT"] : clear.length > 0 ? ["PERSONAL_CHANGE_OBSERVED"] : ["STATISTICAL_UNCERTAINTY"]
  });

  const glp1Event = [...input.medicationEvents]
    .filter((event) => event.medicationClass === "glp1")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const causeExplanation = blankExplanation();
  let causeStatus: JudgmentResult["status"] = "insufficient_data";
  let causeCodes = ["NO_ALIGNED_MEDICATION_EVENT"];

  if (glp1Event && changeJudgment.status === "observable_change") {
    if ((input.confounders?.length ?? 0) > 0) {
      causeStatus = "confounded";
      causeCodes = ["TEMPORAL_OVERLAP", "CONFOUNDERS_PRESENT"];
      causeExplanation.possibleInterpretation.push("변화 시점과 투약 사건이 겹치지만 다른 요인도 함께 존재합니다.");
    } else {
      causeStatus = "temporally_associated";
      causeCodes = ["TEMPORAL_OVERLAP"];
      causeExplanation.possibleInterpretation.push("변화 시작 시점과 투약 사건의 시간상 겹침이 관찰됐습니다.");
    }
    causeExplanation.unknown.push("관찰 자료만으로 약이 원인이라고 확정할 수 없습니다.");
    causeExplanation.nextAction.push("감염·음주·운동·섭취량·기기 변화 등 함께 변한 요인을 확인합니다.");
  } else {
    causeExplanation.unknown.push("명확한 개인 변화와 정렬 가능한 투약 사건이 모두 필요합니다.");
    causeExplanation.nextAction.push("원인 판단 대신 자료 품질과 안전 신호를 먼저 확인합니다.");
  }

  const causeJudgment = judgment(input, {
    kind: "cause",
    status: causeStatus,
    confidence: "low",
    metricChanges: changes,
    explanation: causeExplanation,
    dataQuality,
    reasonCodes: causeCodes
  });

  const safety = assessSafety(input);
  const riskExplanation = blankExplanation();
  if (safety.escalationCodes.length > 0) {
    riskExplanation.observation.push("상품 선택보다 먼저 확인해야 할 위험 신호가 입력됐습니다.");
    riskExplanation.unknown.push("이 엔진은 증상의 정확한 원인이나 치료를 결정하지 않습니다.");
    riskExplanation.nextAction.push("상품 추천을 멈추고 의료기관 또는 응급 도움을 우선 안내합니다.");
  } else if (safety.unknownFields.length > 0) {
    riskExplanation.unknown.push("필수 안전 확인이 끝나지 않아 '위험 신호 없음'으로 간주하지 않습니다.");
    riskExplanation.nextAction.push("상품을 보기 전에 가장 영향이 큰 안전 질문부터 확인합니다.");
  } else {
    riskExplanation.observation.push("현재 입력된 필수 위험 신호에는 해당 항목이 없습니다.");
    riskExplanation.unknown.push("위험 신호가 없다는 입력은 의학적 안전을 보증하지 않습니다.");
    riskExplanation.nextAction.push("새롭거나 심해지는 증상이 있으면 다시 안전 확인을 합니다.");
  }
  const riskJudgment = judgment(input, {
    kind: "risk",
    status: safety.escalationCodes.length > 0
      ? "safety_escalation"
      : safety.unknownFields.length > 0 ? "safety_unknown" : "no_red_flag_detected",
    confidence: safety.escalationCodes.length > 0 ? "high" : safety.unknownFields.length > 0 ? "low" : "moderate",
    metricChanges: [],
    explanation: riskExplanation,
    dataQuality: safety.unknownFields.length > 0 ? "fail" : "pass",
    reasonCodes: safety.escalationCodes.length > 0
      ? safety.escalationCodes
      : safety.unknownFields.length > 0
        ? safety.unknownFields.map((field) => `UNKNOWN_${field.replaceAll(".", "_").toUpperCase()}`)
        : ["REQUIRED_SAFETY_SCREEN_CONFIRMED_CLEAR"]
  });

  const compareExplanation = blankExplanation();
  compareExplanation.unknown.push("비슷한 사용자와 비교할 충분하고 승인된 코호트가 없습니다.");
  compareExplanation.nextAction.push("표본·동의·편향 검토가 끝나기 전에는 비교 위치를 표시하지 않습니다.");
  const compareJudgment = judgment(input, {
    kind: "compare",
    status: "comparison_unavailable",
    confidence: "low",
    metricChanges: [],
    explanation: compareExplanation,
    dataQuality: input.cohortComparisonApproved ? "low" : "fail",
    reasonCodes: [input.cohortComparisonApproved ? "COHORT_DATA_NOT_SUPPLIED" : "COHORT_COMPARISON_NOT_APPROVED"]
  });

  const plateauExplanation = blankExplanation();
  plateauExplanation.unknown.push("정체 판정에는 더 긴 추세와 섭취·활동·치료 맥락이 필요합니다.");
  plateauExplanation.nextAction.push("오늘 데모에서는 정체나 약 조정 결론을 내리지 않습니다.");
  const plateauJudgment = judgment(input, {
    kind: "plateau",
    status: "plateau_unavailable",
    confidence: "low",
    metricChanges: [],
    explanation: plateauExplanation,
    dataQuality,
    reasonCodes: ["PLATEAU_RULE_NOT_VALIDATED"]
  });

  const effectExplanation = blankExplanation();
  effectExplanation.unknown.push("개인 효과 판정에는 승인된 n-of-1 설계, 순응도, 사전등록 결과변수가 필요합니다.");
  effectExplanation.nextAction.push("연구 승인과 프로토콜이 없으면 효과를 주장하지 않습니다.");
  const effectJudgment = judgment(input, {
    kind: "effect",
    status: "research_not_approved",
    confidence: "low",
    metricChanges: [],
    explanation: effectExplanation,
    dataQuality: input.nof1ProtocolApproved ? "low" : "fail",
    reasonCodes: [input.nof1ProtocolApproved ? "NOF1_DATA_NOT_SUPPLIED" : "NOF1_RESEARCH_NOT_APPROVED"]
  });

  return [changeJudgment, causeJudgment, riskJudgment, compareJudgment, plateauJudgment, effectJudgment];
}

function missingFields(input: EngineInput): string[] {
  const missing: string[] = [...assessSafety(input).unknownFields];
  if (input.question.intentCodes.length === 0) missing.push("question.intentCodes");
  if (input.nutrition.proteinMealsPerDay === undefined) missing.push("nutrition.proteinMealsPerDay");
  return [...new Set(missing)];
}

const CLARIFICATION_DEFINITIONS: Record<string, Omit<ClarificationRequest, "field">> = {
  "screening.redFlagSymptoms": {
    code: "RED_FLAG_SCREEN",
    question: "심한 복통이 계속되거나 반복해서 토하고 있나요? 물을 마시기 어렵거나 실신·호흡곤란이 있었나요?",
    why: "해당하면 상품 비교보다 의료 확인이 먼저이기 때문입니다.",
    priorityScore: 100,
    safetyGate: true,
  },
  "screening.adultStatus": {
    code: "ADULT_STATUS",
    question: "만 19세 이상 성인인가요?",
    why: "미성년자에게는 자동 상품 연결을 제공하지 않기 때문입니다.",
    priorityScore: 95,
    safetyGate: true,
  },
  "screening.pregnantOrLactating": {
    code: "PREGNANCY_LACTATION",
    question: "현재 임신 중이거나 수유 중인가요?",
    why: "임신·수유 중에는 상품보다 전문가 검토가 우선이기 때문입니다.",
    priorityScore: 90,
    safetyGate: true,
  },
  "screening.eatingDisorderConcern": {
    code: "EATING_DISORDER_CONCERN",
    question: "최근 섭식장애 치료 중이거나 관련 우려를 의료진과 상의한 적이 있나요?",
    why: "식사 제한을 강화할 수 있는 자동 추천을 피하기 위해서입니다.",
    priorityScore: 85,
    safetyGate: true,
  },
  "screening.allergens": {
    code: "ALLERGENS_REVIEW",
    question: "확인된 식품 알레르기가 있나요? 없다면 '없음 확인'으로 답해 주세요.",
    why: "빈 목록을 '알레르기 없음'으로 오해하면 위험한 상품이 남을 수 있기 때문입니다.",
    priorityScore: 80,
    safetyGate: true,
  },
  "question.intentCodes": {
    code: "INTENT_CONFIRMATION",
    question: "지금 가장 먼저 해결하려는 것은 섭취 부족, 단백질 보완, 수면 변화 중 무엇인가요?",
    why: "관련 없는 상품을 후보로 가져오지 않기 위해서입니다.",
    priorityScore: 50,
    safetyGate: false,
  },
  "nutrition.proteinMealsPerDay": {
    code: "PROTEIN_MEALS",
    question: "단백질이 포함된 식사를 하루에 보통 몇 번 하나요?",
    why: "제품보다 음식 보완이 먼저인지 결정하는 핵심 정보이기 때문입니다.",
    priorityScore: 40,
    safetyGate: false,
  },
};

function nextClarification(missing: string[]): ClarificationRequest | null {
  return missing
    .map((field) => {
      const definition = CLARIFICATION_DEFINITIONS[field];
      return definition ? { field, ...definition } : null;
    })
    .filter((item): item is ClarificationRequest => item !== null)
    .sort((a, b) => b.priorityScore - a.priorityScore || a.field.localeCompare(b.field))[0] ?? null;
}

function medicationBoundary(input: EngineInput): boolean {
  return MEDICATION_BOUNDARY_PATTERNS.some((pattern) => pattern.test(input.question.text));
}

function decisionExplanation(
  disposition: DecisionDisposition,
  judgments: JudgmentResult[],
  eligible: CandidateEvaluation[],
  missing: string[]
): FourSlotExplanation {
  const change = judgments.find((item) => item.kind === "change");
  const cause = judgments.find((item) => item.kind === "cause");
  const risk = judgments.find((item) => item.kind === "risk");
  const explanation = blankExplanation();
  explanation.observation.push(...(change?.explanation.observation ?? []));
  explanation.possibleInterpretation.push(...(cause?.explanation.possibleInterpretation ?? []));
  explanation.unknown.push(...(change?.explanation.unknown ?? []), ...(cause?.explanation.unknown ?? []));

  switch (disposition) {
    case "safety_stop":
      explanation.observation.push(...(risk?.explanation.observation ?? []));
      explanation.unknown.push(...(risk?.explanation.unknown ?? []));
      explanation.nextAction.push(...(risk?.explanation.nextAction ?? []));
      break;
    case "medication_boundary":
      explanation.unknown.push("이 엔진은 개인의 처방약 선택·증량·감량·중단을 결정하지 않습니다.");
      explanation.nextAction.push("현재 변화와 질문을 처방 의료진에게 전달할 수 있게 요약합니다.");
      break;
    case "ask_clarification":
      explanation.unknown.push(`결정에 필요한 정보가 없습니다: ${missing.join(", ")}`);
      explanation.nextAction.push("가장 안전성과 후보군을 크게 바꾸는 질문부터 한 개씩 확인합니다.");
      break;
    case "insufficient_data":
      explanation.nextAction.push("같은 기기의 기준선을 더 확보하고 실제 식사·근력 상태를 먼저 확인합니다.");
      break;
    case "recommend_food_first":
      explanation.nextAction.push("현재 섭취를 먼저 점검하고 일반 음식으로 보완 가능한지 확인합니다.");
      break;
    case "show_eligible_products":
      explanation.nextAction.push(`Hard filter를 통과한 ${eligible.length}개 후보의 근거·함량·가격을 비교합니다.`);
      break;
    case "clinical_consult":
      explanation.nextAction.push("의료진의 개별 검토가 필요한 조건이 있어 상품 비교를 보류합니다.");
      break;
    case "abstain":
      explanation.nextAction.push("현재 조건을 모두 충족하는 검증 가능한 상품 후보가 없어 추천을 보류합니다.");
      break;
  }
  return explanation;
}

function eventId(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
}

function createEvents(
  input: EngineInput,
  disposition: DecisionDisposition,
  eligible: CandidateEvaluation[],
  excluded: CandidateEvaluation[],
  config: EngineConfig
): EngineEvent[] {
  const userHash = createHash("sha256").update(`demo-user-namespace|${input.userId}`).digest("hex").slice(0, 16);
  const sessionHash = createHash("sha256").update(`demo-session-namespace|${input.userId}|${input.requestId}`).digest("hex").slice(0, 16);
  const base = {
    journeyId: `journey_${userHash}`,
    anonymousUserId: `user_${userHash}`,
    anonymousSessionId: `session_${sessionHash}`,
    scenarioId: input.requestId,
    requestScope: "brand_aggregate" as const,
    consentPolicyVersion: config.consentPolicyVersion,
    synthetic: input.synthetic,
    engineVersion: config.engineVersion,
    ruleVersion: config.ruleVersion,
    evidenceVersion: config.evidenceSnapshot
  };
  const events: EngineEvent[] = [];
  const baseTime = Date.parse(input.asOf);
  const push = (
    eventName: EngineEventName,
    extra: Pick<Partial<EngineEvent>, "intentCode" | "verdictCode" | "productId" | "reasonCode"> = {},
  ) => {
    const eventSequence = events.length + 1;
    const occurredAt = new Date(baseTime + eventSequence).toISOString();
    events.push(createEngineEvent({
      ...base,
      ...extra,
      occurredAt,
      eventSequence,
      eventId: eventId([input.requestId, eventName, extra.productId ?? "", extra.reasonCode ?? "", String(eventSequence)]),
      eventName,
    }));
  };

  push("chat_question_asked");
  for (const intentCode of input.question.intentCodes) push("chat_intent_classified", { intentCode });
  if (missingFields(input).length === 0) push("clarification_answered");
  if (disposition === "safety_stop" || disposition === "medication_boundary") {
    push("guardrail_blocked", { verdictCode: disposition });
  } else if (!nextClarification(missingFields(input))?.safetyGate) {
    push("safety_check_passed", { verdictCode: disposition });
  }
  push("engine_verdict_generated", { verdictCode: disposition });
  for (const item of [...eligible, ...excluded]) push("candidate_generated", { productId: item.product.productId });
  for (const item of excluded) {
    if (item.constraint === "diversity_hold") {
      push("candidate_diversity_held", {
        productId: item.product.productId,
        reasonCode: "DIVERSITY_DUPLICATE",
      });
      continue;
    }
    for (const reason of item.exclusionReasons) {
      push("candidate_filtered", { productId: item.product.productId, reasonCode: reason.code });
      if (/MISSING|STALE|UNKNOWN/.test(reason.code)) {
        push("candidate_data_gap", { productId: item.product.productId, reasonCode: reason.code });
      }
    }
  }
  for (const item of eligible) {
    push("candidate_eligible", { productId: item.product.productId });
    push("recommendation_ranked", { productId: item.product.productId });
  }
  if (disposition === "show_eligible_products") {
    for (const item of eligible.slice(0, 3)) push("recommendation_impression", { productId: item.product.productId });
  }
  return events;
}

export function decide(
  input: EngineInput,
  catalog: ProductCandidate[],
  config: EngineConfig = DEFAULT_ENGINE_CONFIG
): EngineDecision {
  if (!input.consentScopes.includes("service")) {
    throw new Error("SERVICE_CONSENT_REQUIRED");
  }

  const metricChanges = analyzeMetricChanges(input, config);
  const judgments = buildSixJudgments(input, metricChanges);
  const missing = missingFields(input);
  const clarification = nextClarification(missing);
  const retrievalSnapshot = retrieveProducts(input, catalog);
  const hasSafetyEscalation = judgments.some((item) => item.kind === "risk" && item.status === "safety_escalation");
  const changeUnavailable = judgments.some((item) => item.kind === "change" && item.status === "insufficient_data");

  let disposition: DecisionDisposition;
  let eligible: CandidateEvaluation[] = [];
  let excluded: CandidateEvaluation[] = [];

  // Positive safety/protected-population signals always outrank a medication
  // boundary collision. Unknown safety gates also stop all product work.
  if (hasSafetyEscalation) {
    disposition = "safety_stop";
  } else if (clarification?.safetyGate) {
    disposition = "ask_clarification";
  } else if (medicationBoundary(input)) {
    disposition = "medication_boundary";
  } else if (missing.length > 0) {
    disposition = "ask_clarification";
  } else if (changeUnavailable) {
    disposition = "insufficient_data";
  } else {
    const productResult = evaluateProducts(input, catalog, judgments, config);
    eligible = productResult.eligible;
    excluded = productResult.excluded;
    const expertReview = excluded.some((item) => item.constraint === "expert_review");

    if ((input.nutrition.proteinMealsPerDay ?? 0) >= 2) {
      disposition = "recommend_food_first";
    } else if (eligible.length > 0) {
      disposition = "show_eligible_products";
    } else if (expertReview) {
      disposition = "clinical_consult";
    } else {
      disposition = "abstain";
    }
  }

  const analyticsEmission: EngineDecision["analyticsEmission"] =
    !input.consentScopes.includes("brand_aggregate")
      ? "scope_missing"
      : input.consentPolicyVersion !== config.consentPolicyVersion
        ? "policy_version_mismatch"
        : "allowed";
  const events = analyticsEmission === "allowed"
    ? createEvents(input, disposition, eligible, excluded, config)
    : [];
  return {
    requestId: input.requestId,
    disposition,
    judgments,
    eligible,
    excluded,
    explanation: decisionExplanation(disposition, judgments, eligible, missing),
    missingFields: missing,
    nextClarification: disposition === "ask_clarification" ? clarification : null,
    retrieval: {
      catalogCount: catalog.length,
      retrievedCount: retrievalSnapshot.retrieved.length,
      notRetrievedCount: retrievalSnapshot.notRetrieved.length,
      intentCodes: [...input.question.intentCodes],
    },
    analyticsEmission,
    events,
    versions: {
      engine: config.engineVersion,
      rules: config.ruleVersion,
      evidenceSnapshot: config.evidenceSnapshot,
      productSnapshot: config.productSnapshot
    },
    generatedAt: input.asOf,
    synthetic: input.synthetic
  };
}
