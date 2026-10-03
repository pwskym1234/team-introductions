export type ScreenId =
  | "overview"
  | "questions"
  | "funnel"
  | "products"
  | "engine"
  | "quality";

export type Disposition =
  | "show_eligible_products"
  | "recommend_food_first"
  | "safety_stop"
  | "insufficient_data"
  | "clinical_consult"
  | "ask_clarification"
  | "abstain";

export type IntentCode =
  | "PROTEIN_SUPPORT"
  | "REDUCED_INTAKE"
  | "SIDE_EFFECT_CONCERN"
  | "SLEEP_CHANGE"
  | "MUSCLE_LOSS_CONCERN"
  | "MEDICATION_CHANGE";

export type StageId =
  | "question_submitted"
  | "intent_classified"
  | "information_complete"
  | "safety_passed"
  | "candidate_generated"
  | "eligible_product"
  | "recommendation_shown"
  | "evidence_opened"
  | "product_clicked";

export interface SessionFact {
  id: string;
  occurredAt: string;
  day: string;
  intent: IntentCode;
  clusterId: string;
  clusterLabel: string;
  syntheticQuestion: string;
  disposition: Disposition;
  completedStages: StageId[];
  engineVersion: "v1.2" | "v1.3";
  parserVersion: "geo-0.8" | "geo-0.9";
  latencyMs: number;
  productIds: string[];
  reasonCodes: string[];
  groundTruth: "true_positive" | "false_positive" | "true_negative" | "unreviewed";
  evidenceOpened: boolean;
  clicked: boolean;
  synthetic: true;
}

export interface ProductDefinition {
  id: string;
  shortName: string;
  category: string;
  format: string;
  price: string;
  status: "verified" | "attention" | "review";
  primaryGap?: string;
}

export interface TraceStep {
  id: string;
  eyebrow: string;
  title: string;
  status: "passed" | "warning" | "blocked" | "pending";
  engineSummary: string;
  reasonCodes: string[];
  consumerTitle: string;
  consumerBody: string;
  brandEvent?: string;
  brandEffect?: string;
}

export interface EngineControls {
  scenario: "U-01" | "U-02" | "U-03";
  milkAllergy: boolean;
  severeSymptoms: boolean;
  baselineDays: number;
}

export const FUNNEL_STAGES: Array<{ id: StageId; label: string; shortLabel: string }> = [
  { id: "question_submitted", label: "질문 수신", shortLabel: "질문" },
  { id: "intent_classified", label: "의도 분류", shortLabel: "분류" },
  { id: "information_complete", label: "정보 완료", shortLabel: "완료" },
  { id: "safety_passed", label: "안전 통과", shortLabel: "안전" },
  { id: "candidate_generated", label: "후보 생성", shortLabel: "후보" },
  { id: "eligible_product", label: "적격 상품", shortLabel: "적격" },
  { id: "recommendation_shown", label: "사용자 노출", shortLabel: "노출" },
  { id: "evidence_opened", label: "근거 열람", shortLabel: "근거" },
  { id: "product_clicked", label: "상품 클릭", shortLabel: "클릭" },
];

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  show_eligible_products: "적격 상품 노출",
  recommend_food_first: "음식 우선",
  safety_stop: "안전 중단",
  insufficient_data: "데이터 부족",
  clinical_consult: "전문가 확인",
  ask_clarification: "추가 질문",
  abstain: "판단 보류",
};

export const INTENT_LABELS: Record<IntentCode, string> = {
  PROTEIN_SUPPORT: "단백질 보완",
  REDUCED_INTAKE: "식사량 감소",
  SIDE_EFFECT_CONCERN: "부작용 우려",
  SLEEP_CHANGE: "수면 변화",
  MUSCLE_LOSS_CONCERN: "근손실 우려",
  MEDICATION_CHANGE: "약 변경 문의",
};

export const PRODUCTS: ProductDefinition[] = [
  {
    id: "P01",
    shortName: "유청 분리 단백 A",
    category: "단백질",
    format: "파우더",
    price: "₩39,900",
    status: "verified",
  },
  {
    id: "P03",
    shortName: "대두 분리 단백 C",
    category: "단백질",
    format: "파우더",
    price: "₩34,900",
    status: "verified",
  },
  {
    id: "P04",
    shortName: "완두 단백 D",
    category: "단백질",
    format: "파우더",
    price: "₩36,900",
    status: "verified",
  },
  {
    id: "P05",
    shortName: "혼합 식물 단백 E",
    category: "단백질",
    format: "파우더",
    price: "₩42,900",
    status: "attention",
    primaryGap: "PRODUCT_DATA_STALE",
  },
  {
    id: "P08",
    shortName: "다성분 식사대용 H",
    category: "식사대용",
    format: "음료",
    price: "₩4,900",
    status: "review",
    primaryGap: "INTERACTION_UNVERIFIED",
  },
  {
    id: "P09",
    shortName: "종합비타민 I",
    category: "멀티비타민",
    format: "정제",
    price: "₩24,900",
    status: "attention",
    primaryGap: "EVIDENCE_MISSING",
  },
];

const CLUSTERS: Array<{
  id: string;
  label: string;
  intent: IntentCode;
  example: string;
}> = [
  {
    id: "q-low-intake",
    label: "증량 뒤 식사량 감소",
    intent: "REDUCED_INTAKE",
    example: "증량 뒤 식사량이 줄었어요. 무엇부터 확인해야 하나요?",
  },
  {
    id: "q-protein",
    label: "단백질 보완 선택",
    intent: "PROTEIN_SUPPORT",
    example: "단백질이 부족한 것 같은데 어떤 형태를 비교하면 좋을까요?",
  },
  {
    id: "q-side-effect",
    label: "위장 증상과 안전",
    intent: "SIDE_EFFECT_CONCERN",
    example: "배가 아프고 계속 토하는데 제품을 먹어도 될까요?",
  },
  {
    id: "q-sleep",
    label: "수면·회복 변화",
    intent: "SLEEP_CHANGE",
    example: "최근 잠을 자주 깨요. 기기 변화도 같이 봐 줄 수 있나요?",
  },
  {
    id: "q-muscle",
    label: "근손실 우려",
    intent: "MUSCLE_LOSS_CONCERN",
    example: "체중이 줄면서 근손실이 걱정돼요. 무엇을 기록해야 하나요?",
  },
  {
    id: "q-medication",
    label: "용량·약 변경 문의",
    intent: "MEDICATION_CHANGE",
    example: "용량을 올리거나 다른 약으로 바꿔도 될까요?",
  },
];

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function dispositionFor(random: () => number, intent: IntentCode): Disposition {
  const value = random();
  if (intent === "MEDICATION_CHANGE") {
    if (value < 0.72) return "clinical_consult";
    if (value < 0.9) return "ask_clarification";
    return "insufficient_data";
  }
  if (intent === "SIDE_EFFECT_CONCERN") {
    if (value < 0.25) return "safety_stop";
    if (value < 0.44) return "clinical_consult";
  }
  if (value < 0.56) return "show_eligible_products";
  if (value < 0.69) return "recommend_food_first";
  if (value < 0.77) return "insufficient_data";
  if (value < 0.84) return "ask_clarification";
  if (value < 0.9) return "clinical_consult";
  if (value < 0.95) return "safety_stop";
  return "abstain";
}

function stagesFor(
  random: () => number,
  disposition: Disposition,
): { stages: StageId[]; opened: boolean; clicked: boolean } {
  const stages: StageId[] = ["question_submitted", "intent_classified"];
  if (disposition === "ask_clarification") return { stages, opened: false, clicked: false };
  stages.push("information_complete");
  if (disposition === "safety_stop") return { stages, opened: false, clicked: false };
  stages.push("safety_passed");
  if (disposition === "insufficient_data") return { stages, opened: false, clicked: false };
  stages.push("candidate_generated");
  if (disposition !== "show_eligible_products") return { stages, opened: false, clicked: false };
  stages.push("eligible_product");
  const shown = random() > 0.045;
  if (!shown) return { stages, opened: false, clicked: false };
  stages.push("recommendation_shown");
  const opened = random() < 0.46;
  if (opened) stages.push("evidence_opened");
  const clicked = opened && random() < 0.34;
  if (clicked) stages.push("product_clicked");
  return { stages, opened, clicked };
}

function productSelection(random: () => number, disposition: Disposition): string[] {
  if (disposition !== "show_eligible_products") return [];
  const primary = random() < 0.55 ? "P04" : "P03";
  const second = primary === "P04" ? "P03" : "P04";
  return random() < 0.7 ? [primary, second] : [primary];
}

function reasonCodesFor(
  random: () => number,
  disposition: Disposition,
  intent: IntentCode,
): string[] {
  if (disposition === "safety_stop") return ["RED_FLAG_PRESENT"];
  if (disposition === "insufficient_data") {
    return random() < 0.55 ? ["BASELINE_INSUFFICIENT"] : ["DEVICE_CHANGED"];
  }
  if (disposition === "clinical_consult") {
    return intent === "MEDICATION_CHANGE" ? ["MEDICATION_BOUNDARY"] : ["INTERACTION_UNVERIFIED"];
  }
  if (disposition === "ask_clarification") return ["REQUIRED_FIELD_MISSING"];
  if (disposition === "recommend_food_first") return ["FOOD_FIRST_THRESHOLD"];
  if (disposition === "abstain") return ["NO_ELIGIBLE_CANDIDATE"];
  const reasons: string[] = [];
  if (random() < 0.23) reasons.push("ALLERGEN_MATCH");
  if (random() < 0.18) reasons.push("PRODUCT_DATA_STALE");
  if (random() < 0.12) reasons.push("EVIDENCE_MISSING");
  return reasons.length > 0 ? reasons : ["ELIGIBLE_CANDIDATE_FOUND"];
}

export function buildSyntheticSessions(count = 1280): SessionFact[] {
  const random = mulberry32(20261003);
  const end = Date.UTC(2026, 9, 3, 14, 20, 0);
  const dayMs = 86_400_000;
  const rows: SessionFact[] = [];

  for (let index = 0; index < count; index += 1) {
    const clusterRoll = random();
    const clusterIndex = clusterRoll < 0.27
      ? 0
      : clusterRoll < 0.52
        ? 1
        : clusterRoll < 0.69
          ? 2
          : clusterRoll < 0.82
            ? 3
            : clusterRoll < 0.94
              ? 4
              : 5;
    const cluster = CLUSTERS[clusterIndex];
    const disposition = dispositionFor(random, cluster.intent);
    const { stages, opened, clicked } = stagesFor(random, disposition);
    const dayOffset = Math.floor(random() * 90);
    const timestamp = new Date(
      end - dayOffset * dayMs - Math.floor(random() * 20 * 60 * 60 * 1000),
    );
    const isAlert = disposition === "safety_stop" || random() < 0.09;
    const groundTruthRoll = random();
    const groundTruth = !isAlert
      ? "true_negative"
      : groundTruthRoll < 0.48
        ? "true_positive"
        : groundTruthRoll < 0.72
          ? "false_positive"
          : "unreviewed";

    rows.push({
      id: `Q-${String(index + 1).padStart(5, "0")}`,
      occurredAt: timestamp.toISOString(),
      day: timestamp.toISOString().slice(0, 10),
      intent: cluster.intent,
      clusterId: cluster.id,
      clusterLabel: cluster.label,
      syntheticQuestion: cluster.example,
      disposition,
      completedStages: stages,
      engineVersion: dayOffset < 36 ? "v1.3" : "v1.2",
      parserVersion: dayOffset < 28 ? "geo-0.9" : "geo-0.8",
      latencyMs: Math.round(240 + random() * 1160),
      productIds: productSelection(random, disposition),
      reasonCodes: reasonCodesFor(random, disposition, cluster.intent),
      groundTruth,
      evidenceOpened: opened,
      clicked,
      synthetic: true,
    });
  }

  return rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export const SYNTHETIC_SESSIONS = buildSyntheticSessions();

export function buildTrace(controls: EngineControls): {
  steps: TraceStep[];
  disposition: Disposition;
  products: Array<{ id: string; name: string; state: string; score?: number; reason?: string }>;
  question: string;
  judgments: Array<{ label: string; status: string; tone: "good" | "warn" | "neutral" }>;
} {
  const scenarioQuestions = {
    "U-01": "증량하고 나서 밤에 자꾸 깨고, 식사량도 줄었어요. 약 때문인지, 뭘 먹어야 하는지 궁금해요.",
    "U-02": "배가 심하게 계속 아프고 반복해서 토해요. 마시기 쉬운 쉐이크를 추천해 주세요.",
    "U-03": "근손실을 막을 단백질 제품을 골라 주세요. 새 워치는 산 지 5일 됐어요.",
  } as const;

  const forcedSafety = controls.severeSymptoms || controls.scenario === "U-02";
  const insufficient = !forcedSafety && (controls.baselineDays < 28 || controls.scenario === "U-03");
  const disposition: Disposition = forcedSafety
    ? "safety_stop"
    : insufficient
      ? "insufficient_data"
      : "show_eligible_products";

  const stopAfter = forcedSafety ? 3 : insufficient ? 4 : 11;
  const rawSteps: Omit<TraceStep, "status">[] = [
    {
      id: "question",
      eyebrow: "01 · 질문 접수",
      title: "사용자의 질문을 받습니다",
      engineSummary: "원문은 대화 경계 안에 두고 trace ID를 발급했습니다.",
      reasonCodes: ["QUESTION_ACCEPTED"],
      consumerTitle: "질문을 이해하고 있어요",
      consumerBody: "안전 확인부터 필요한 정보를 한 번에 하나씩 묻습니다.",
      brandEvent: "question_submitted",
      brandEffect: "질문 세션 +1",
    },
    {
      id: "parse",
      eyebrow: "02 · GEO 파싱",
      title: "문장을 안전한 코드로 바꿉니다",
      engineSummary: controls.scenario === "U-02"
        ? "SIDE_EFFECT_CONCERN · PROTEIN_SUPPORT"
        : "REDUCED_INTAKE · PROTEIN_SUPPORT · SLEEP_CHANGE",
      reasonCodes: ["INTENT_CLASSIFIED", "RAW_TEXT_REDACTED"],
      consumerTitle: "질문의 목적을 나눴어요",
      consumerBody: "식사량, 안전 증상, 단백질 보완을 각각 따로 판단합니다.",
      brandEvent: "intent_classified",
      brandEffect: "intent 분포 갱신",
    },
    {
      id: "quality",
      eyebrow: "03 · 입력 품질",
      title: "같은 사람·같은 기기인지 먼저 봅니다",
      engineSummary: `같은 기기 ${controls.baselineDays}일 · 완전성 96% · 시간대 Asia/Seoul`,
      reasonCodes: controls.baselineDays < 28 ? ["BASELINE_INSUFFICIENT"] : ["DATA_QUALITY_PASS"],
      consumerTitle: controls.baselineDays < 28 ? "비교할 기록이 더 필요해요" : "비교할 기준선이 충분해요",
      consumerBody: controls.baselineDays < 28
        ? "새 기기 기록은 옛 기기 값과 바로 비교하지 않습니다."
        : "같은 기기의 4~6주 기록으로 평소 흔들림을 먼저 계산했습니다.",
      brandEvent: "data_quality_checked",
      brandEffect: controls.baselineDays < 28 ? "데이터 부족 +1" : "품질 통과 +1",
    },
    {
      id: "risk",
      eyebrow: "04 · 위험 신호",
      title: forcedSafety ? "상품보다 의료 확인이 먼저입니다" : "즉시 중단할 위험 신호는 없습니다",
      engineSummary: forcedSafety
        ? "심한 지속 복통 또는 반복 구토 → 상품 평가 중단"
        : "중증 복통·반복 구토·수분 섭취 불가 없음",
      reasonCodes: forcedSafety ? ["RED_FLAG_PRESENT", "SAFETY_ESCALATION"] : ["NO_RED_FLAG_DETECTED"],
      consumerTitle: forcedSafety ? "지금은 제품을 고르지 않습니다" : "다음 계산으로 넘어갈 수 있어요",
      consumerBody: forcedSafety
        ? "심한 복통과 반복 구토는 즉시 의료 도움을 확인해야 하는 신호입니다."
        : "현재 입력에서 즉시 상품 흐름을 멈출 신호는 없었습니다.",
      brandEvent: forcedSafety ? "safety_stopped" : "safety_passed",
      brandEffect: forcedSafety ? "안전 전환 +1 · 상품 노출 +0" : "안전 통과 +1",
    },
    {
      id: "statistics",
      eyebrow: "05 · 변화와 불확실성",
      title: insufficient ? "변화량을 확정하지 않습니다" : "변화 크기와 오차 범위를 같이 계산합니다",
      engineSummary: insufficient
        ? "기준선 최소 28일 미달 → CI·다중성 판정 닫힘"
        : "HRV −8.96ms [−11.28, −6.64] · RHR +4.87bpm · Holm 보정",
      reasonCodes: insufficient ? ["BASELINE_INSUFFICIENT"] : ["HAC_CI_COMPUTED", "HOLM_ADJUSTED"],
      consumerTitle: insufficient ? "아직 비교할 수 없어요" : "같은 기기 기준선에서 변화가 관찰됐어요",
      consumerBody: insufficient
        ? "기록을 더 모은 뒤 같은 계산을 다시 실행합니다."
        : "원인을 단정하지 않고 변화량, 95% 범위, 데이터 품질을 함께 보여줍니다.",
      brandEvent: "metric_change_computed",
      brandEffect: insufficient ? "insufficient_data +1" : "observable_change +1",
    },
    {
      id: "judgments",
      eyebrow: "06 · 판정 6종",
      title: "여섯 질문의 경계를 따로 지킵니다",
      engineSummary: "변화=관찰 · 원인=시점 겹침 · 위험=통과 · 비교/정체/효과=닫힘",
      reasonCodes: ["CHANGE_OBSERVED", "TEMPORALLY_ASSOCIATED", "RESEARCH_NOT_APPROVED"],
      consumerTitle: "말할 수 있는 것과 모르는 것을 나눴어요",
      consumerBody: "‘약 때문’이라고 진단하지 않고 관련 시점과 다른 가능성을 함께 표시합니다.",
      brandEvent: "judgments_computed",
      brandEffect: "판정 분포 6개 갱신",
    },
    {
      id: "retrieve",
      eyebrow: "07 · 후보 검색",
      title: "질문 목적에 맞는 상품만 가져옵니다",
      engineSummary: "PROTEIN_SUPPORT → 단백질/식사대용 5개 후보",
      reasonCodes: ["CATEGORY_RETRIEVAL_MATCH"],
      consumerTitle: "목적과 무관한 상품은 빼고 있어요",
      consumerBody: "단백질 보완과 직접 관련된 카테고리만 다음 단계로 보냅니다.",
      brandEvent: "candidate_generated",
      brandEffect: "후보 상품 5건 추가",
    },
    {
      id: "hard-filter",
      eyebrow: "08 · Hard filter",
      title: controls.milkAllergy ? "알레르기 상품은 점수 전에 제외합니다" : "현재 알레르기 충돌은 없습니다",
      engineSummary: controls.milkAllergy
        ? "P01 우유 알레르기 일치 → EXCLUDE · P08 상호작용 미검증 → REVIEW"
        : "P01 알레르기 통과 · P08 상호작용 미검증 → REVIEW",
      reasonCodes: controls.milkAllergy ? ["ALLERGEN_MATCH", "INTERACTION_UNVERIFIED"] : ["INTERACTION_UNVERIFIED"],
      consumerTitle: controls.milkAllergy ? "우유 성분 상품은 보여주지 않아요" : "적격 후보를 비교할 수 있어요",
      consumerBody: "광고비나 인기와 관계없이 안전·근거·라벨 조건을 먼저 적용합니다.",
      brandEvent: "candidate_evaluated",
      brandEffect: controls.milkAllergy ? "P01 제외 +1" : "P01 적격 +1",
    },
    {
      id: "score",
      eyebrow: "09 · 적격 후보 점수",
      title: "통과한 상품끼리만 순서를 정합니다",
      engineSummary: controls.milkAllergy
        ? "P04 75.94 · P03 74.26 · 전환율/수수료 0점"
        : "P01 82.10 · P04 75.94 · P03 74.26 · 전환율/수수료 0점",
      reasonCodes: ["EVIDENCE_FIT_DATA_FEASIBILITY", "UNCERTAINTY_PENALTY"],
      consumerTitle: "근거와 내 조건에 맞는 순서예요",
      consumerBody: "근거 40%, 개인 적합 30%, 상품 데이터 20%, 실행 가능성 10%에서 불확실성을 뺐습니다.",
      brandEvent: "eligible_products_ranked",
      brandEffect: controls.milkAllergy ? "적격 P04·P03" : "적격 P01·P04·P03",
    },
    {
      id: "decision",
      eyebrow: "10 · 최종 결정",
      title: "음식 우선 안내와 적격 상품 비교를 엽니다",
      engineSummary: "disposition = show_eligible_products",
      reasonCodes: ["ELIGIBLE_CANDIDATE_FOUND"],
      consumerTitle: "먼저 음식으로 채우는 방법을 보고, 필요하면 상품을 비교하세요",
      consumerBody: "추천은 진단이나 치료 지시가 아니며, 가격·라벨 확인 시각을 함께 보여줍니다.",
      brandEvent: "decision_completed",
      brandEffect: "판정 완료 +1",
    },
    {
      id: "events",
      eyebrow: "11 · 개인정보 축소",
      title: "브랜드에 보낼 이벤트를 최소화합니다",
      engineSummary: "원문·약명·개인 metric 제거 → intent/verdict/reason/product code만 유지",
      reasonCodes: ["BRAND_PAYLOAD_SANITIZED"],
      consumerTitle: "개인 질문은 브랜드에 전달되지 않아요",
      consumerBody: "브랜드는 집계와 상품 데이터 결측만 확인합니다.",
      brandEvent: "brand_event_sanitized",
      brandEffect: "안전한 집계 이벤트 생성",
    },
    {
      id: "aggregate",
      eyebrow: "12 · 브랜드 집계",
      title: "질문 하나가 대시보드 숫자로 반영됩니다",
      engineSummary: "같은 trace의 순서를 보존해 funnel과 상품 진단을 갱신했습니다.",
      reasonCodes: ["ORDERED_FUNNEL_UPDATED"],
      consumerTitle: "판단이 끝났어요",
      consumerBody: "이 실행의 결과와 이유는 같은 엔진 버전으로 재현할 수 있습니다.",
      brandEvent: "aggregate_updated",
      brandEffect: "질문 +1 · 안전 통과 +1 · 적격 노출 +1",
    },
  ];

  const steps = rawSteps.map((step, index): TraceStep => ({
    ...step,
    status: index < stopAfter
      ? "passed"
      : index === stopAfter
        ? forcedSafety
          ? "blocked"
          : insufficient
            ? "warning"
            : "passed"
        : index <= stopAfter
          ? "passed"
          : "pending",
  }));

  const products = forcedSafety || insufficient
    ? []
    : [
        ...(controls.milkAllergy
          ? [{ id: "P01", name: "유청 분리 단백 A", state: "제외", reason: "우유 알레르기 일치" }]
          : [{ id: "P01", name: "유청 분리 단백 A", state: "적격", score: 82.1 }]),
        { id: "P04", name: "완두 단백 D", state: "적격", score: 75.94 },
        { id: "P03", name: "대두 분리 단백 C", state: "적격", score: 74.26 },
        { id: "P08", name: "다성분 식사대용 H", state: "검토", reason: "상호작용 미검증" },
      ];

  const judgments = [
    { label: "변화", status: insufficient ? "계산 불가" : "관찰됨", tone: insufficient ? "neutral" : "good" },
    { label: "원인", status: insufficient ? "모름" : "시점 겹침", tone: "warn" },
    { label: "위험", status: forcedSafety ? "즉시 확인" : "신호 없음", tone: forcedSafety ? "warn" : "good" },
    { label: "비교", status: "표본 없음", tone: "neutral" },
    { label: "정체", status: "범위 밖", tone: "neutral" },
    { label: "효과", status: "연구 미승인", tone: "neutral" },
  ] as Array<{ label: string; status: string; tone: "good" | "warn" | "neutral" }>;

  return {
    steps,
    disposition,
    products,
    question: scenarioQuestions[controls.scenario],
    judgments,
  };
}

export function seededRandom(seed: number): () => number {
  return mulberry32(seed);
}
