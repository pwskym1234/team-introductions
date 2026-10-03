/**
 * Browser-safe, deterministic analytics ledger used by the brand intelligence UI.
 *
 * This module never stores question text, medicine names, identifiers supplied by a
 * person, or raw health values. Every row is synthetic and every user id is an
 * anonymous, generated key.
 */

export const SYNTHETIC_DATA_NOTICE =
  "아래 수치는 실제 고객 데이터가 아닌, 제품 동작을 검증하기 위해 고정 시드로 만든 합성 데이터입니다.";

export const DATASET_SEED = 20261003;
export const DATASET_TIME_ZONE = "Asia/Seoul";
export const DATASET_WINDOW = {
  start: "2026-07-06",
  end: "2026-10-03",
  days: 90,
} as const;

export type AcquisitionChannel =
  | "organic_search"
  | "paid_search"
  | "instagram"
  | "kakao"
  | "direct"
  | "email"
  | "partner";

export type Platform = "web" | "ios" | "android" | "embedded_chat";
export type DeviceType = "mobile" | "desktop" | "tablet";
export type Campaign =
  | "none"
  | "protein_basics"
  | "appetite_recovery"
  | "healthy_routine"
  | "product_compare"
  | "brand_content";
export type RegionBucket =
  | "seoul"
  | "gyeonggi_incheon"
  | "chungcheong"
  | "gyeongsang"
  | "jeolla_jeju"
  | "gangwon";
export type VisitType = "new" | "returning";
export type LifecycleStage =
  | "first_question"
  | "exploring"
  | "comparing"
  | "returned_after_click"
  | "retained";

export type IntentCategory =
  | "nutrition_support"
  | "safety_check"
  | "routine_change"
  | "ingredient_check"
  | "treatment_boundary";

export type IntentCluster =
  | "reduced_intake_support"
  | "protein_selection"
  | "muscle_concern"
  | "sleep_recovery_change"
  | "digestive_safety"
  | "combination_safety"
  | "ingredient_allergy"
  | "format_price_preference";

export type EngineVersion = "1.2.0" | "1.3.0" | "1.4.0";
export type ParserVersion = "geo-0.8" | "geo-0.9" | "geo-1.0";
export type DataQualityBand = "good" | "usable" | "insufficient";
export type DecisionResult =
  | "show_products"
  | "food_first"
  | "safety_stop"
  | "need_more_information"
  | "consult_professional"
  | "no_suitable_product";
export type SafetyResult = "passed" | "stopped" | "not_checked";
export type CandidateStatus = "eligible" | "excluded" | "needs_review";

export type JudgmentType =
  | "change"
  | "cause"
  | "risk"
  | "peer_comparison"
  | "persistence"
  | "product_effect";

export type JudgmentOutcome =
  | "change_observed"
  | "no_clear_change"
  | "not_enough_data"
  | "timing_overlaps"
  | "cause_not_supported"
  | "risk_passed"
  | "risk_stopped"
  | "comparison_available"
  | "comparison_unavailable"
  | "change_persisted"
  | "short_term_only"
  | "effect_not_established";

export type EventName =
  | "question_started"
  | "intent_classified"
  | "clarification_asked"
  | "information_completed"
  | "safety_checked"
  | "data_quality_checked"
  | "judgment_completed"
  | "candidates_searched"
  | "candidate_evaluated"
  | "decision_completed"
  | "recommendation_shown"
  | "evidence_opened"
  | "product_clicked"
  | "user_returned";

export interface SyntheticUser {
  anonymousUserId: string;
  firstSeenAt: string;
  acquisitionChannel: AcquisitionChannel;
  firstPlatform: Platform;
  firstDevice: DeviceType;
  regionBucket: RegionBucket;
  primaryIntentCluster: IntentCluster;
  plannedQuestionCount: number;
  synthetic: true;
}

/** Properties shared by every event in one question journey. */
export interface QuestionContext {
  questionDate: string;
  channel: AcquisitionChannel;
  platform: Platform;
  device: DeviceType;
  campaign: Campaign;
  regionBucket: RegionBucket;
  visitType: VisitType;
  lifecycleStage: LifecycleStage;
  intentCategory: IntentCategory;
  intentCluster: IntentCluster;
  engineVersion: EngineVersion;
  parserVersion: ParserVersion;
  baselineDays: number;
  dataCompleteness: number;
  dataQualityBand: DataQualityBand;
  clarificationCount: number;
  totalLatencyMs: number;
  decision: DecisionResult;
  synthetic: true;
}

export interface JudgmentResult {
  type: JudgmentType;
  outcome: JudgmentOutcome;
  confidence: "high" | "medium" | "low";
  reasonCode: string;
}

export interface QuestionJourney {
  questionId: string;
  sessionId: string;
  anonymousUserId: string;
  questionNumberForUser: number;
  previousQuestionId: string | null;
  startedAt: string;
  completedAt: string;
  context: QuestionContext;
  safetyResult: SafetyResult;
  decision: DecisionResult;
  reasonCodes: string[];
  judgments: JudgmentResult[];
  candidateProductIds: string[];
  eligibleProductIds: string[];
  exposedProductIds: string[];
  evidenceOpenedProductId: string | null;
  clickedProductId: string | null;
  returnedWithin14Days: boolean;
  returnAfterDays: number | null;
  synthetic: true;
}

export interface AnalyticsEventProperties {
  clarificationNumber?: number;
  informationStatus?: "complete" | "abandoned";
  safetyResult?: SafetyResult;
  dataQualityBand?: DataQualityBand;
  judgmentType?: JudgmentType;
  judgmentOutcome?: JudgmentOutcome;
  judgmentConfidence?: "high" | "medium" | "low";
  productId?: string;
  productCategory?: ProductCategory;
  productScore?: number;
  candidateStatus?: CandidateStatus;
  productIds?: string[];
  decision?: DecisionResult;
  reasonCodes?: string[];
  stepDurationMs?: number;
  returnAfterDays?: number;
  linkedQuestionId?: string;
}

export interface AnalyticsEvent {
  eventId: string;
  questionId: string;
  sessionId: string;
  anonymousUserId: string;
  timestamp: string;
  sequence: number;
  name: EventName;
  context: QuestionContext;
  properties: AnalyticsEventProperties;
  synthetic: true;
}

export type ProductCategory =
  | "protein_powder"
  | "protein_drink"
  | "meal_supplement";

export interface ProductCatalogItem {
  productId: string;
  name: string;
  category: ProductCategory;
  format: "powder" | "ready_to_drink" | "small_carton";
  priceBand: "value" | "mid" | "premium";
  containsMilk: boolean;
  interactionEvidence: "verified" | "partial" | "missing";
  labelFreshness: "current" | "review_due";
  synthetic: true;
}

export interface SyntheticAnalyticsDataset {
  users: SyntheticUser[];
  questions: QuestionJourney[];
  events: AnalyticsEvent[];
  products: ProductCatalogItem[];
  generatedWithSeed: number;
  notice: string;
  window: typeof DATASET_WINDOW;
  synthetic: true;
}

export const PRODUCT_CATALOG: ProductCatalogItem[] = [
  { productId: "P01", name: "웨이 단백 파우더", category: "protein_powder", format: "powder", priceBand: "mid", containsMilk: true, interactionEvidence: "verified", labelFreshness: "current", synthetic: true },
  { productId: "P02", name: "저유당 단백 음료", category: "protein_drink", format: "ready_to_drink", priceBand: "premium", containsMilk: true, interactionEvidence: "verified", labelFreshness: "current", synthetic: true },
  { productId: "P03", name: "대두 단백 파우더", category: "protein_powder", format: "powder", priceBand: "value", containsMilk: false, interactionEvidence: "verified", labelFreshness: "current", synthetic: true },
  { productId: "P04", name: "완두 단백 파우더", category: "protein_powder", format: "powder", priceBand: "mid", containsMilk: false, interactionEvidence: "verified", labelFreshness: "current", synthetic: true },
  { productId: "P05", name: "식물성 단백 블렌드", category: "protein_powder", format: "powder", priceBand: "premium", containsMilk: false, interactionEvidence: "partial", labelFreshness: "review_due", synthetic: true },
  { productId: "P06", name: "고단백 영양 음료", category: "meal_supplement", format: "ready_to_drink", priceBand: "premium", containsMilk: true, interactionEvidence: "partial", labelFreshness: "current", synthetic: true },
  { productId: "P07", name: "소용량 식사 보충 음료", category: "meal_supplement", format: "small_carton", priceBand: "mid", containsMilk: false, interactionEvidence: "verified", labelFreshness: "current", synthetic: true },
  { productId: "P08", name: "균형 영양 쉐이크", category: "meal_supplement", format: "powder", priceBand: "value", containsMilk: false, interactionEvidence: "missing", labelFreshness: "review_due", synthetic: true },
];

export const EVENT_LABELS: Record<EventName, string> = {
  question_started: "질문 시작",
  intent_classified: "질문 목적 확인",
  clarification_asked: "추가 정보 요청",
  information_completed: "필요 정보 확인 완료",
  safety_checked: "위험 신호 확인",
  data_quality_checked: "비교할 기록 점검",
  judgment_completed: "판단 항목 계산",
  candidates_searched: "관련 상품 찾기",
  candidate_evaluated: "상품별 적합성 확인",
  decision_completed: "안내 방식 결정",
  recommendation_shown: "적격 상품 노출",
  evidence_opened: "선정 근거 열람",
  product_clicked: "상품 상세 클릭",
  user_returned: "다시 방문",
};

export const EVENT_DEFINITIONS: Record<EventName, string> = {
  question_started: "익명 사용자가 새 질문 흐름을 시작한 시점입니다. 질문 원문은 저장하지 않습니다.",
  intent_classified: "문장을 분석해 마케터가 집계할 수 있는 질문 목적 코드로 바꾼 시점입니다.",
  clarification_asked: "안전하거나 정확한 판단에 필요한 정보가 부족해 한 가지를 더 물은 시점입니다.",
  information_completed: "이번 판단에 꼭 필요한 입력이 모인 시점입니다.",
  safety_checked: "상품을 보여주기 전에 즉시 안내가 필요한 위험 신호를 확인한 시점입니다.",
  data_quality_checked: "같은 기기 기준선과 기록 충실도가 비교에 충분한지 확인한 시점입니다.",
  judgment_completed: "변화·원인·위험·비교·지속성·상품 효과 중 한 항목의 판단을 마친 시점입니다.",
  candidates_searched: "질문 목적과 직접 관련된 상품군만 후보로 불러온 시점입니다.",
  candidate_evaluated: "후보 한 개를 안전 조건, 근거, 라벨 정보, 실행 가능성으로 확인한 시점입니다.",
  decision_completed: "상품 노출, 음식 우선, 전문가 확인 등 사용자에게 보여줄 안내 방식을 정한 시점입니다.",
  recommendation_shown: "모든 필수 조건을 통과한 상품이 실제 화면에 나타난 시점입니다.",
  evidence_opened: "사용자가 해당 상품이 선정된 근거를 펼쳐 본 시점입니다.",
  product_clicked: "사용자가 상품 상세 정보로 이동한 시점입니다.",
  user_returned: "이전 질문 뒤 같은 익명 사용자가 다시 방문한 시점입니다. 며칠 뒤 돌아왔는지는 별도 속성으로 남깁니다.",
};

export const DEFAULT_FUNNEL_STEPS: EventName[] = [
  "question_started",
  "intent_classified",
  "information_completed",
  "safety_checked",
  "candidates_searched",
  "candidate_evaluated",
  "decision_completed",
  "recommendation_shown",
  "evidence_opened",
  "product_clicked",
];

export const FIELD_LABELS = {
  questionDate: "질문 날짜",
  channel: "처음 들어온 경로",
  platform: "이용 화면",
  device: "기기 종류",
  campaign: "유입 캠페인",
  regionBucket: "넓은 지역 구간",
  visitType: "방문 유형",
  lifecycleStage: "이용 단계",
  intentCategory: "질문 큰 분류",
  intentCluster: "구체적인 질문 목적",
  engineVersion: "판단 엔진 버전",
  parserVersion: "질문 분석기 버전",
  baselineDays: "비교에 쓴 기준 기록 일수",
  dataCompleteness: "필요 정보 충족률",
  dataQualityBand: "비교할 기록 상태",
  clarificationCount: "추가 질문 횟수",
  totalLatencyMs: "결과가 나오기까지 걸린 시간",
  decision: "사용자에게 보여준 안내",
  productScore: "적격 상품 점수",
  candidateStatus: "상품 검토 결과",
  reasonCodes: "결정 근거",
} as const;

export const FIELD_DEFINITIONS: Record<keyof typeof FIELD_LABELS, string> = {
  questionDate: "질문 흐름이 시작된 한국 시간 기준 날짜입니다.",
  channel: "이번 방문이 검색, 광고, 직접 방문 등 어디에서 시작됐는지 보여줍니다.",
  platform: "웹, iOS, Android, 제휴 챗봇 중 어느 화면을 썼는지 보여줍니다.",
  device: "개인을 특정하지 않는 모바일·데스크톱·태블릿 구분입니다.",
  campaign: "이번 방문과 연결된 마케팅 활동입니다. 연결되지 않으면 ‘캠페인 없음’입니다.",
  regionBucket: "개인을 찾을 수 없도록 시·군보다 크게 묶은 지역 구간입니다.",
  visitType: "이 익명 사용자의 첫 질문인지, 이전 질문 뒤 다시 온 방문인지 구분합니다.",
  lifecycleStage: "첫 질문, 탐색, 비교, 클릭 후 재방문, 반복 이용 중 어디에 있는지 보여줍니다.",
  intentCategory: "영양 보완, 안전 확인 등 질문의 넓은 목적입니다.",
  intentCluster: "‘식사량 감소 뒤 보완’처럼 마케터가 행동 차이를 볼 수 있는 구체 목적입니다.",
  engineVersion: "같은 결과를 재현하고 버전 변경 전후를 비교하기 위한 판단 로직 버전입니다.",
  parserVersion: "질문을 집계 코드로 바꾼 분석 로직 버전입니다.",
  baselineDays: "변화를 비교할 때 사용 가능한 같은 조건의 과거 기록 일수입니다. 원래 값은 저장하지 않습니다.",
  dataCompleteness: "필수 입력 중 실제로 확인된 항목의 비율입니다.",
  dataQualityBand: "기록이 판단에 충분한지 ‘충분·사용 가능·부족’으로 묶은 결과입니다.",
  clarificationCount: "정보를 채우기 위해 사용자에게 추가로 물은 횟수입니다.",
  totalLatencyMs: "질문 시작부터 최종 안내까지 걸린 밀리초입니다.",
  decision: "최종적으로 상품, 음식 우선, 안전 중단, 추가 질문 등 무엇을 안내했는지 보여줍니다.",
  productScore: "필수 조건을 통과한 상품끼리 근거·적합성·정보 품질·실행 가능성을 비교한 0~100 점수입니다.",
  candidateStatus: "상품이 적격인지, 제외됐는지, 사람이 더 확인해야 하는지 보여줍니다.",
  reasonCodes: "결정이 나온 이유를 재현할 수 있도록 남긴 표준 코드입니다.",
};

export const VALUE_LABELS = {
  channels: {
    organic_search: "자연 검색", paid_search: "검색 광고", instagram: "인스타그램", kakao: "카카오", direct: "직접 방문", email: "이메일", partner: "제휴 채널",
  } satisfies Record<AcquisitionChannel, string>,
  platforms: {
    web: "웹", ios: "iOS 앱", android: "Android 앱", embedded_chat: "제휴 챗봇",
  } satisfies Record<Platform, string>,
  devices: {
    mobile: "모바일", desktop: "데스크톱", tablet: "태블릿",
  } satisfies Record<DeviceType, string>,
  campaigns: {
    none: "캠페인 없음", protein_basics: "단백질 선택 가이드", appetite_recovery: "식사량 회복 안내", healthy_routine: "건강 루틴 콘텐츠", product_compare: "상품 비교 재방문", brand_content: "브랜드 정보 콘텐츠",
  } satisfies Record<Campaign, string>,
  regions: {
    seoul: "서울", gyeonggi_incheon: "경기·인천", chungcheong: "충청", gyeongsang: "경상", jeolla_jeju: "전라·제주", gangwon: "강원",
  } satisfies Record<RegionBucket, string>,
  visitTypes: { new: "첫 방문", returning: "재방문" } satisfies Record<VisitType, string>,
  lifecycleStages: {
    first_question: "첫 질문", exploring: "정보 탐색", comparing: "상품 비교", returned_after_click: "클릭 후 재방문", retained: "반복 이용",
  } satisfies Record<LifecycleStage, string>,
  intentCategories: {
    nutrition_support: "영양 보완", safety_check: "안전 확인", routine_change: "생활 변화 확인", ingredient_check: "성분 확인", treatment_boundary: "전문가 판단 영역",
  } satisfies Record<IntentCategory, string>,
  intentClusters: {
    reduced_intake_support: "식사량이 줄어 보완이 필요함", protein_selection: "나에게 맞는 단백질을 고르고 싶음", muscle_concern: "체중 감소와 근손실이 걱정됨", sleep_recovery_change: "수면·회복 기록이 달라짐", digestive_safety: "위장 불편이 있어 안전부터 확인함", combination_safety: "복용 중인 것과 함께 써도 되는지 확인함", ingredient_allergy: "성분·알레르기 조건을 확인함", format_price_preference: "가격·형태가 맞는 상품을 비교함",
  } satisfies Record<IntentCluster, string>,
  quality: { good: "충분", usable: "사용 가능", insufficient: "부족" } satisfies Record<DataQualityBand, string>,
  decisions: {
    show_products: "적격 상품 보여주기", food_first: "음식으로 먼저 보완하기", safety_stop: "상품 탐색을 멈추고 안전 안내", need_more_information: "정보를 더 확인한 뒤 판단", consult_professional: "전문가 확인 권장", no_suitable_product: "조건에 맞는 상품 없음",
  } satisfies Record<DecisionResult, string>,
  candidateStatuses: { eligible: "적격", excluded: "제외", needs_review: "추가 확인 필요" } satisfies Record<CandidateStatus, string>,
  judgmentTypes: {
    change: "실제로 변화가 있었나?", cause: "무엇 때문이라고 말할 수 있나?", risk: "지금 확인해야 할 위험 신호가 있나?", peer_comparison: "비슷한 조건과 비교할 수 있나?", persistence: "일시적인가, 계속되는가?", product_effect: "상품 효과라고 말할 수 있나?",
  } satisfies Record<JudgmentType, string>,
} as const;

export const JUDGMENT_OUTCOME_LABELS: Record<JudgmentOutcome, string> = {
  change_observed: "평소 변동 범위를 벗어난 변화가 보임",
  no_clear_change: "평소 변동 범위 안이라 뚜렷한 변화로 보기 어려움",
  not_enough_data: "비교할 기록이 부족해 판단하지 않음",
  timing_overlaps: "시점은 겹치지만 원인이라고 단정할 수 없음",
  cause_not_supported: "현재 기록만으로 원인을 뒷받침할 수 없음",
  risk_passed: "즉시 흐름을 멈출 위험 신호는 확인되지 않음",
  risk_stopped: "위험 신호가 있어 상품 탐색을 중단함",
  comparison_available: "조건이 비슷한 익명 집단과 비교 가능",
  comparison_unavailable: "안전한 비교 집단이나 표본이 부족함",
  change_persisted: "둘 이상의 관찰 구간에서 변화가 이어짐",
  short_term_only: "한 관찰 구간에서만 나타난 단기 변화",
  effect_not_established: "이 기록만으로 상품 효과라고 말할 수 없음",
};

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  protein_powder: "단백질 파우더",
  protein_drink: "바로 마시는 단백질 음료",
  meal_supplement: "식사 보충 제품",
};

export const REASON_LABELS: Record<string, { label: string; definition: string }> = {
  INTENT_CODE_CREATED: { label: "질문 목적을 확인함", definition: "원문을 저장하지 않고 집계 가능한 질문 목적 코드만 만들었습니다." },
  RAW_TEXT_NOT_STORED: { label: "질문 원문을 저장하지 않음", definition: "브랜드 분석 데이터에는 사용자가 쓴 문장이 포함되지 않습니다." },
  REQUIRED_CONTEXT_MISSING: { label: "판단에 필요한 정보가 부족함", definition: "안전하거나 적절한 안내를 위해 한 가지 정보를 더 확인해야 합니다." },
  SAFETY_CONTEXT_MISSING: { label: "안전 확인 정보가 부족함", definition: "위험 신호 여부를 판단하는 데 필요한 답이 아직 없습니다." },
  REQUIRED_INFORMATION_INCOMPLETE: { label: "추가 질문이 완료되지 않음", definition: "사용자가 필요한 정보 확인을 끝내지 않아 다음 판단으로 넘어가지 않았습니다." },
  RED_FLAG_PRESENT: { label: "먼저 확인할 위험 신호가 있음", definition: "상품보다 안전 안내를 우선해야 하는 신호가 확인됐습니다." },
  NO_RED_FLAG_DETECTED: { label: "즉시 중단할 신호가 없음", definition: "현재 입력에서는 상품 흐름을 바로 멈출 위험 신호가 확인되지 않았습니다." },
  SAFETY_FLOW_TAKES_PRIORITY: { label: "상품보다 안전 안내를 우선함", definition: "위험 신호가 있어 점수 계산과 상품 노출을 실행하지 않았습니다." },
  DEVICE_CONTEXT_CHANGED: { label: "비교 조건이 달라짐", definition: "기기나 측정 조건이 바뀌어 이전 기록과 직접 비교하지 않았습니다." },
  BASELINE_INSUFFICIENT: { label: "평소 기준 기록이 부족함", definition: "변화를 계산하는 데 필요한 같은 조건의 과거 기록이 충분하지 않습니다." },
  COMPARISON_DATA_USABLE: { label: "비교할 기록을 사용할 수 있음", definition: "기준 기간과 기록 충실도가 최소 조건을 충족했습니다." },
  CHANGE_ABOVE_EXPECTED_VARIATION: { label: "평소보다 큰 변화가 보임", definition: "관찰된 변화가 평소 흔들림의 예상 범위를 벗어났습니다." },
  CHANGE_WITHIN_EXPECTED_VARIATION: { label: "평소 흔들림 범위 안임", definition: "관찰된 값의 차이가 평소에도 나타날 수 있는 범위 안입니다." },
  TEMPORAL_ASSOCIATION_ONLY: { label: "시점만 겹침", definition: "두 일이 비슷한 시기에 있었지만 원인과 결과라고 단정하지 않습니다." },
  CAUSE_NOT_ESTABLISHED: { label: "원인은 확인할 수 없음", definition: "현재 관찰 데이터만으로 특정 원인을 뒷받침할 수 없습니다." },
  REFERENCE_GROUP_CHECKED: { label: "비슷한 조건의 집단과 비교함", definition: "개인을 식별할 수 없는 충분한 표본의 비교 집단을 사용했습니다." },
  REFERENCE_GROUP_NOT_AVAILABLE: { label: "안전한 비교 집단이 없음", definition: "조건이 맞고 표본이 충분한 비교 집단을 만들 수 없었습니다." },
  REPEATED_WINDOW_CHECKED: { label: "여러 기간에 걸쳐 확인함", definition: "한 번의 흔들림인지 보기 위해 둘 이상의 관찰 구간을 확인했습니다." },
  FOLLOW_UP_WINDOW_INSUFFICIENT: { label: "지속 여부를 볼 기간이 부족함", definition: "변화가 이어지는지 판단할 후속 관찰 기간이 충분하지 않습니다." },
  PRODUCT_EFFECT_NOT_ESTABLISHED: { label: "상품 효과로 단정하지 않음", definition: "관찰 데이터만으로 상품이 변화를 만들었다고 말하지 않습니다." },
  INTENT_MATCHED_CATEGORY: { label: "질문 목적과 맞는 상품군만 찾음", definition: "질문과 직접 관련 없는 상품 카테고리는 후보 단계에서 제외했습니다." },
  MILK_INGREDIENT_CONFLICT: { label: "우유 유래 성분 조건과 맞지 않음", definition: "확인된 성분 조건과 충돌해 점수 계산 전에 제외했습니다." },
  INTERACTION_EVIDENCE_MISSING: { label: "함께 사용할 때의 확인 자료가 부족함", definition: "상호작용을 검토할 자료가 충분하지 않아 자동 노출하지 않았습니다." },
  LABEL_REVIEW_DUE: { label: "상품 표시 정보 갱신 확인이 필요함", definition: "라벨이나 성분 정보의 최신 여부를 담당자가 확인해야 합니다." },
  REQUIRED_CONDITIONS_PASSED: { label: "필수 조건을 통과함", definition: "안전, 근거, 라벨 정보의 필수 조건을 모두 통과했습니다." },
  ELIGIBLE_PRODUCTS_FOUND: { label: "조건에 맞는 상품이 있음", definition: "필수 조건을 통과한 후보가 있어 상품 비교 화면을 열었습니다." },
  FOOD_FIRST_OPTION_AVAILABLE: { label: "음식으로 먼저 보완할 수 있음", definition: "상품을 바로 고르기 전에 음식으로 채우는 선택지를 먼저 안내했습니다." },
  TREATMENT_DECISION_BOUNDARY: { label: "전문가 판단이 필요한 질문임", definition: "복용이나 치료 변경에 해당해 상품 엔진이 대신 결정하지 않습니다." },
  PRODUCT_REVIEW_REQUIRED: { label: "상품 정보를 사람이 더 확인해야 함", definition: "자동 노출 전에 브랜드나 전문가의 자료 확인이 필요합니다." },
  COMPARISON_DATA_INSUFFICIENT: { label: "비교할 기록을 더 모아야 함", definition: "현재 기준 기록으로는 변화와 적합성을 안정적으로 판단하기 어렵습니다." },
  NO_ELIGIBLE_PRODUCT: { label: "모든 조건을 통과한 상품이 없음", definition: "후보는 있었지만 필수 조건을 모두 만족한 상품이 없었습니다." },
  ALL_REQUIRED_CONDITIONS_PASSED: { label: "노출 조건을 모두 통과함", definition: "이 상품은 이번 질문의 필수 확인 항목을 통과해 화면에 표시됐습니다." },
};

const INTENT_CATEGORY: Record<IntentCluster, IntentCategory> = {
  reduced_intake_support: "nutrition_support",
  protein_selection: "nutrition_support",
  muscle_concern: "nutrition_support",
  sleep_recovery_change: "routine_change",
  digestive_safety: "safety_check",
  combination_safety: "treatment_boundary",
  ingredient_allergy: "ingredient_check",
  format_price_preference: "nutrition_support",
};

const DAY_MS = 86_400_000;
const DATASET_START_MS = Date.parse("2026-07-06T00:00:00+09:00");
const DATASET_END_MS = Date.parse("2026-10-03T23:59:59+09:00");
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

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

function weightedPick<T>(random: () => number, values: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;
  for (let index = 0; index < values.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return values[index];
  }
  return values[values.length - 1];
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function kstDate(epochMs: number): string {
  return new Date(epochMs + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function versionFor(epochMs: number): { engineVersion: EngineVersion; parserVersion: ParserVersion } {
  const progress = (epochMs - DATASET_START_MS) / (DATASET_END_MS - DATASET_START_MS);
  if (progress < 0.34) return { engineVersion: "1.2.0", parserVersion: "geo-0.8" };
  if (progress < 0.7) return { engineVersion: "1.3.0", parserVersion: "geo-0.9" };
  return { engineVersion: "1.4.0", parserVersion: "geo-1.0" };
}

function platformFor(random: () => number, channel: AcquisitionChannel): Platform {
  if (channel === "partner") return random() < 0.72 ? "embedded_chat" : "web";
  return weightedPick(random, ["web", "ios", "android", "embedded_chat"] as const, [0.48, 0.23, 0.25, 0.04]);
}

function deviceFor(random: () => number, platform: Platform): DeviceType {
  if (platform === "ios" || platform === "android" || platform === "embedded_chat") return "mobile";
  return weightedPick(random, ["mobile", "desktop", "tablet"] as const, [0.55, 0.4, 0.05]);
}

function campaignFor(random: () => number, channel: AcquisitionChannel, intent: IntentCluster): Campaign {
  if (channel === "direct" || channel === "organic_search") {
    return random() < 0.72 ? "none" : intent === "reduced_intake_support" ? "appetite_recovery" : "healthy_routine";
  }
  if (intent === "protein_selection" || intent === "muscle_concern") return random() < 0.58 ? "protein_basics" : "product_compare";
  if (intent === "reduced_intake_support") return "appetite_recovery";
  return random() < 0.5 ? "healthy_routine" : "brand_content";
}

function lifecycleFor(questionNumber: number, clickedPreviously: boolean): LifecycleStage {
  if (questionNumber === 1) return "first_question";
  if (clickedPreviously) return "returned_after_click";
  if (questionNumber >= 4) return "retained";
  return questionNumber === 3 ? "comparing" : "exploring";
}

function qualityFor(baselineDays: number, completeness: number, deviceChanged: boolean): DataQualityBand {
  if (baselineDays < 21 || completeness < 0.72 || deviceChanged) return "insufficient";
  if (baselineDays < 35 || completeness < 0.88) return "usable";
  return "good";
}

function buildJudgments(
  random: () => number,
  quality: DataQualityBand,
  safetyResult: SafetyResult,
): JudgmentResult[] {
  if (safetyResult === "stopped") {
    return [{ type: "risk", outcome: "risk_stopped", confidence: "high", reasonCode: "RED_FLAG_PRESENT" }];
  }
  const sufficient = quality !== "insufficient";
  const observed = sufficient && random() < 0.59;
  return [
    {
      type: "change",
      outcome: sufficient ? (observed ? "change_observed" : "no_clear_change") : "not_enough_data",
      confidence: quality === "good" ? "high" : quality === "usable" ? "medium" : "low",
      reasonCode: sufficient ? (observed ? "CHANGE_ABOVE_EXPECTED_VARIATION" : "CHANGE_WITHIN_EXPECTED_VARIATION") : "BASELINE_INSUFFICIENT",
    },
    {
      type: "cause",
      outcome: observed && random() < 0.62 ? "timing_overlaps" : "cause_not_supported",
      confidence: observed ? "medium" : "low",
      reasonCode: observed ? "TEMPORAL_ASSOCIATION_ONLY" : "CAUSE_NOT_ESTABLISHED",
    },
    { type: "risk", outcome: "risk_passed", confidence: "high", reasonCode: "NO_RED_FLAG_DETECTED" },
    {
      type: "peer_comparison",
      outcome: sufficient && random() < 0.36 ? "comparison_available" : "comparison_unavailable",
      confidence: sufficient ? "medium" : "low",
      reasonCode: sufficient ? "REFERENCE_GROUP_CHECKED" : "REFERENCE_GROUP_NOT_AVAILABLE",
    },
    {
      type: "persistence",
      outcome: sufficient ? (random() < 0.48 ? "change_persisted" : "short_term_only") : "not_enough_data",
      confidence: quality === "good" ? "medium" : "low",
      reasonCode: sufficient ? "REPEATED_WINDOW_CHECKED" : "FOLLOW_UP_WINDOW_INSUFFICIENT",
    },
    { type: "product_effect", outcome: "effect_not_established", confidence: "low", reasonCode: "PRODUCT_EFFECT_NOT_ESTABLISHED" },
  ];
}

function relevantProducts(intent: IntentCluster): ProductCatalogItem[] {
  if (intent === "reduced_intake_support") return PRODUCT_CATALOG.filter((product) => product.category === "meal_supplement" || product.category === "protein_drink");
  if (intent === "protein_selection" || intent === "muscle_concern" || intent === "ingredient_allergy") {
    return PRODUCT_CATALOG.filter((product) => product.category === "protein_powder" || product.category === "protein_drink");
  }
  if (intent === "format_price_preference") return PRODUCT_CATALOG;
  return PRODUCT_CATALOG.filter((product) => product.category === "meal_supplement");
}

interface ProductEvaluation {
  product: ProductCatalogItem;
  status: CandidateStatus;
  score: number;
  reasonCodes: string[];
}

function evaluateProducts(
  random: () => number,
  intent: IntentCluster,
  needsMilkFree: boolean,
): ProductEvaluation[] {
  return relevantProducts(intent).map((product) => {
    const reasonCodes: string[] = [];
    let status: CandidateStatus = "eligible";
    if (needsMilkFree && product.containsMilk) {
      status = "excluded";
      reasonCodes.push("MILK_INGREDIENT_CONFLICT");
    }
    if (status === "eligible" && product.interactionEvidence === "missing") {
      status = "needs_review";
      reasonCodes.push("INTERACTION_EVIDENCE_MISSING");
    }
    if (status === "eligible" && product.labelFreshness === "review_due" && random() < 0.58) {
      status = "needs_review";
      reasonCodes.push("LABEL_REVIEW_DUE");
    }
    const baseScore = product.interactionEvidence === "verified" ? 76 : 68;
    const intentFit = intent === "reduced_intake_support" && product.category === "meal_supplement" ? 8 : 0;
    const score = status === "eligible" ? round(clamp(baseScore + intentFit + random() * 15 - 6, 52, 94), 1) : 0;
    if (status === "eligible") reasonCodes.push("REQUIRED_CONDITIONS_PASSED");
    return { product, status, score, reasonCodes };
  });
}

function decisionFor(
  random: () => number,
  intent: IntentCluster,
  safetyResult: SafetyResult,
  quality: DataQualityBand,
  informationAbandoned: boolean,
  evaluations: ProductEvaluation[],
): DecisionResult {
  if (informationAbandoned) return "need_more_information";
  if (safetyResult === "stopped") return "safety_stop";
  if (intent === "combination_safety") return "consult_professional";
  if (quality === "insufficient") return random() < 0.68 ? "need_more_information" : "food_first";
  const eligible = evaluations.some((evaluation) => evaluation.status === "eligible");
  if (!eligible) return evaluations.some((evaluation) => evaluation.status === "needs_review") ? "consult_professional" : "no_suitable_product";
  return random() < 0.17 ? "food_first" : "show_products";
}

function questionCounts(): number[] {
  // Exactly 6,200 anonymous users and 12,400 questions.
  return [
    ...Array<number>(2500).fill(1),
    ...Array<number>(2100).fill(2),
    ...Array<number>(1000).fill(3),
    ...Array<number>(400).fill(4),
    ...Array<number>(150).fill(5),
    ...Array<number>(50).fill(7),
  ];
}

export function buildSyntheticAnalyticsDataset(seed = DATASET_SEED): SyntheticAnalyticsDataset {
  const random = mulberry32(seed);
  const users: SyntheticUser[] = [];
  const questions: QuestionJourney[] = [];
  const events: AnalyticsEvent[] = [];
  const counts = questionCounts();
  let questionCounter = 0;
  let eventCounter = 0;

  const channels = ["organic_search", "paid_search", "instagram", "kakao", "direct", "email", "partner"] as const;
  const regions = ["seoul", "gyeonggi_incheon", "chungcheong", "gyeongsang", "jeolla_jeju", "gangwon"] as const;
  const intents = ["reduced_intake_support", "protein_selection", "muscle_concern", "sleep_recovery_change", "digestive_safety", "combination_safety", "ingredient_allergy", "format_price_preference"] as const;

  for (let userIndex = 0; userIndex < counts.length; userIndex += 1) {
    const anonymousUserId = `anon_${String(userIndex + 1).padStart(6, "0")}`;
    const acquisitionChannel = weightedPick(random, channels, [0.27, 0.15, 0.14, 0.1, 0.2, 0.06, 0.08]);
    const regionBucket = weightedPick(random, regions, [0.25, 0.3, 0.1, 0.16, 0.12, 0.07]);
    const primaryIntentCluster = weightedPick(random, intents, [0.22, 0.2, 0.13, 0.09, 0.12, 0.07, 0.08, 0.09]);
    const firstPlatform = platformFor(random, acquisitionChannel);
    const firstDevice = deviceFor(random, firstPlatform);
    const userQuestionCount = counts[userIndex];
    const timestamps = Array.from({ length: userQuestionCount }, () => {
      const safeEnd = DATASET_END_MS - 20 * 60 * 1000;
      return Math.floor(DATASET_START_MS + random() * (safeEnd - DATASET_START_MS));
    }).sort((a, b) => a - b);

    const user: SyntheticUser = {
      anonymousUserId,
      firstSeenAt: new Date(timestamps[0]).toISOString(),
      acquisitionChannel,
      firstPlatform,
      firstDevice,
      regionBucket,
      primaryIntentCluster,
      plannedQuestionCount: userQuestionCount,
      synthetic: true as const,
    };
    users.push(user);

    let previousQuestion: QuestionJourney | null = null;
    let previousEvents: AnalyticsEvent[] | null = null;
    let clickedPreviously = false;

    for (let questionIndex = 0; questionIndex < userQuestionCount; questionIndex += 1) {
      questionCounter += 1;
      const questionId = `Q-${String(questionCounter).padStart(6, "0")}`;
      const sessionId = `S-${String(questionCounter).padStart(6, "0")}`;
      const startedAtMs = timestamps[questionIndex];
      const channel = questionIndex === 0
        ? acquisitionChannel
        : weightedPick(random, ["direct", "organic_search", "email", "kakao", acquisitionChannel] as const, [0.42, 0.2, 0.12, 0.1, 0.16]);
      const platform = questionIndex === 0 ? firstPlatform : platformFor(random, channel);
      const device = questionIndex === 0 ? firstDevice : deviceFor(random, platform);
      const intentCluster = random() < 0.63 ? primaryIntentCluster : weightedPick(random, intents, [0.22, 0.2, 0.13, 0.09, 0.12, 0.07, 0.08, 0.09]);
      const versions = versionFor(startedAtMs);
      const deviceChanged = questionIndex > 0 && random() < 0.08;
      const baselineDays = Math.floor(7 + random() * 67);
      const dataCompleteness = round(clamp(0.64 + random() * 0.36 - (deviceChanged ? 0.08 : 0), 0.52, 1), 2);
      const dataQualityBand = qualityFor(baselineDays, dataCompleteness, deviceChanged);
      const clarificationCount = dataCompleteness < 0.75 ? (random() < 0.7 ? 2 : 3) : dataCompleteness < 0.9 ? (random() < 0.58 ? 1 : 0) : 0;
      const informationAbandoned = clarificationCount > 0 && random() < 0.115;
      const safetyRisk = intentCluster === "digestive_safety" ? random() < 0.27 : random() < 0.018;
      const safetyResult: SafetyResult = informationAbandoned ? "not_checked" : safetyRisk ? "stopped" : "passed";
      const judgments = buildJudgments(random, dataQualityBand, safetyResult);
      const needsMilkFree = intentCluster === "ingredient_allergy" ? random() < 0.76 : random() < 0.11;
      const evaluations = safetyResult === "passed" && !informationAbandoned && intentCluster !== "sleep_recovery_change"
        ? evaluateProducts(random, intentCluster, needsMilkFree)
        : [];
      const decision = decisionFor(random, intentCluster, safetyResult, dataQualityBand, informationAbandoned, evaluations);
      const eligibleEvaluations = evaluations.filter((evaluation) => evaluation.status === "eligible").sort((a, b) => b.score - a.score);
      const exposedEvaluations = decision === "show_products" ? eligibleEvaluations.slice(0, random() < 0.72 ? 3 : 2) : [];
      const evidenceOpened = exposedEvaluations.length > 0 && random() < 0.47 ? pick(random, exposedEvaluations) : null;
      const clicked = evidenceOpened && random() < 0.38
        ? evidenceOpened
        : exposedEvaluations.length > 0 && random() < 0.065
          ? pick(random, exposedEvaluations)
          : null;
      const totalLatencyMs = Math.round(
        420 + clarificationCount * (280 + random() * 420) + evaluations.length * (34 + random() * 28) + random() * 860,
      );
      const context: QuestionContext = {
        questionDate: kstDate(startedAtMs),
        channel,
        platform,
        device,
        campaign: campaignFor(random, channel, intentCluster),
        regionBucket,
        visitType: questionIndex === 0 ? "new" : "returning",
        lifecycleStage: lifecycleFor(questionIndex + 1, clickedPreviously),
        intentCategory: INTENT_CATEGORY[intentCluster],
        intentCluster,
        engineVersion: versions.engineVersion,
        parserVersion: versions.parserVersion,
        baselineDays,
        dataCompleteness,
        dataQualityBand,
        clarificationCount,
        totalLatencyMs,
        decision,
        synthetic: true,
      };
      const questionEvents: AnalyticsEvent[] = [];
      let sequence = 0;
      let eventTimeMs = startedAtMs;
      const addEvent = (name: EventName, durationMs: number, properties: AnalyticsEventProperties = {}): void => {
        sequence += 1;
        eventTimeMs += durationMs;
        eventCounter += 1;
        const event: AnalyticsEvent = {
          eventId: `E-${String(eventCounter).padStart(7, "0")}`,
          questionId,
          sessionId,
          anonymousUserId,
          timestamp: new Date(eventTimeMs).toISOString(),
          sequence,
          name,
          context,
          properties: { ...properties, stepDurationMs: durationMs },
          synthetic: true,
        };
        questionEvents.push(event);
        events.push(event);
      };

      addEvent("question_started", 0);
      addEvent("intent_classified", Math.round(80 + random() * 170), { reasonCodes: ["INTENT_CODE_CREATED", "RAW_TEXT_NOT_STORED"] });
      for (let clarificationIndex = 0; clarificationIndex < clarificationCount; clarificationIndex += 1) {
        addEvent("clarification_asked", Math.round(180 + random() * 520), {
          clarificationNumber: clarificationIndex + 1,
          reasonCodes: [clarificationIndex === 0 ? "REQUIRED_CONTEXT_MISSING" : "SAFETY_CONTEXT_MISSING"],
        });
      }

      if (informationAbandoned) {
        addEvent("decision_completed", Math.round(100 + random() * 180), {
          decision,
          informationStatus: "abandoned",
          reasonCodes: ["REQUIRED_INFORMATION_INCOMPLETE"],
        });
      } else {
        addEvent("information_completed", Math.round(95 + random() * 180), { informationStatus: "complete" });
        addEvent("safety_checked", Math.round(35 + random() * 70), {
          safetyResult,
          reasonCodes: safetyResult === "stopped" ? ["RED_FLAG_PRESENT"] : ["NO_RED_FLAG_DETECTED"],
        });

        if (safetyResult === "stopped") {
          addEvent("decision_completed", Math.round(45 + random() * 70), { decision, reasonCodes: ["SAFETY_FLOW_TAKES_PRIORITY"] });
        } else {
          addEvent("data_quality_checked", Math.round(55 + random() * 105), {
            dataQualityBand,
            reasonCodes: dataQualityBand === "insufficient"
              ? [deviceChanged ? "DEVICE_CONTEXT_CHANGED" : "BASELINE_INSUFFICIENT"]
              : ["COMPARISON_DATA_USABLE"],
          });
          judgments.forEach((judgment) => {
            addEvent("judgment_completed", Math.round(16 + random() * 35), {
              judgmentType: judgment.type,
              judgmentOutcome: judgment.outcome,
              judgmentConfidence: judgment.confidence,
              reasonCodes: [judgment.reasonCode],
            });
          });

          if (evaluations.length > 0) {
            addEvent("candidates_searched", Math.round(40 + random() * 85), {
              productIds: evaluations.map((evaluation) => evaluation.product.productId),
              reasonCodes: ["INTENT_MATCHED_CATEGORY"],
            });
            evaluations.forEach((evaluation) => {
              addEvent("candidate_evaluated", Math.round(22 + random() * 48), {
                productId: evaluation.product.productId,
                productCategory: evaluation.product.category,
                productScore: evaluation.score,
                candidateStatus: evaluation.status,
                reasonCodes: evaluation.reasonCodes,
              });
            });
          }

          const decisionReasons = decision === "show_products"
            ? ["ELIGIBLE_PRODUCTS_FOUND"]
            : decision === "food_first"
              ? ["FOOD_FIRST_OPTION_AVAILABLE"]
              : decision === "consult_professional"
                ? [intentCluster === "combination_safety" ? "TREATMENT_DECISION_BOUNDARY" : "PRODUCT_REVIEW_REQUIRED"]
                : decision === "need_more_information"
                  ? ["COMPARISON_DATA_INSUFFICIENT"]
                  : ["NO_ELIGIBLE_PRODUCT"];
          addEvent("decision_completed", Math.round(55 + random() * 125), { decision, reasonCodes: decisionReasons });

          exposedEvaluations.forEach((evaluation) => {
            addEvent("recommendation_shown", Math.round(12 + random() * 32), {
              productId: evaluation.product.productId,
              productCategory: evaluation.product.category,
              productScore: evaluation.score,
              candidateStatus: "eligible",
              reasonCodes: ["ALL_REQUIRED_CONDITIONS_PASSED"],
            });
          });
          if (evidenceOpened) {
            addEvent("evidence_opened", Math.round(800 + random() * 7800), {
              productId: evidenceOpened.product.productId,
              productCategory: evidenceOpened.product.category,
              productScore: evidenceOpened.score,
            });
          }
          if (clicked) {
            addEvent("product_clicked", Math.round(900 + random() * 9400), {
              productId: clicked.product.productId,
              productCategory: clicked.product.category,
              productScore: clicked.score,
            });
          }
        }
      }

      const reasonCodes = Array.from(new Set(questionEvents.flatMap((event) => event.properties.reasonCodes ?? [])));
      const journey: QuestionJourney = {
        questionId,
        sessionId,
        anonymousUserId,
        questionNumberForUser: questionIndex + 1,
        previousQuestionId: previousQuestion?.questionId ?? null,
        startedAt: new Date(startedAtMs).toISOString(),
        completedAt: new Date(eventTimeMs).toISOString(),
        context,
        safetyResult,
        decision,
        reasonCodes,
        judgments,
        candidateProductIds: evaluations.map((evaluation) => evaluation.product.productId),
        eligibleProductIds: eligibleEvaluations.map((evaluation) => evaluation.product.productId),
        exposedProductIds: exposedEvaluations.map((evaluation) => evaluation.product.productId),
        evidenceOpenedProductId: evidenceOpened?.product.productId ?? null,
        clickedProductId: clicked?.product.productId ?? null,
        returnedWithin14Days: false,
        returnAfterDays: null,
        synthetic: true,
      };

      if (previousQuestion && previousEvents) {
        const previousStartMs = Date.parse(previousQuestion.startedAt);
        const gapDays = Math.max(1, Math.floor((startedAtMs - previousStartMs) / DAY_MS));
        if (gapDays <= 14) {
          previousQuestion.returnedWithin14Days = true;
          previousQuestion.returnAfterDays = gapDays;
        } else {
          previousQuestion.returnAfterDays = gapDays;
        }
        const priorLast = previousEvents[previousEvents.length - 1];
        eventCounter += 1;
        const returnEvent: AnalyticsEvent = {
          eventId: `E-${String(eventCounter).padStart(7, "0")}`,
          questionId: previousQuestion.questionId,
          sessionId: previousQuestion.sessionId,
          anonymousUserId,
          timestamp: new Date(Math.max(Date.parse(priorLast.timestamp) + 1_000, startedAtMs - 30_000)).toISOString(),
          sequence: priorLast.sequence + 1,
          name: "user_returned",
          context: previousQuestion.context,
          properties: { returnAfterDays: gapDays, linkedQuestionId: questionId },
          synthetic: true,
        };
        previousEvents.push(returnEvent);
        events.push(returnEvent);
      }

      questions.push(journey);
      previousQuestion = journey;
      previousEvents = questionEvents;
      clickedPreviously = Boolean(clicked);
    }
  }

  events.sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.eventId.localeCompare(right.eventId));
  questions.sort((left, right) => left.startedAt.localeCompare(right.startedAt));

  return {
    users,
    questions,
    events,
    products: PRODUCT_CATALOG,
    generatedWithSeed: seed,
    notice: SYNTHETIC_DATA_NOTICE,
    window: DATASET_WINDOW,
    synthetic: true,
  };
}

export const SYNTHETIC_ANALYTICS = buildSyntheticAnalyticsDataset();
export const SYNTHETIC_USERS = SYNTHETIC_ANALYTICS.users;
export const SYNTHETIC_QUESTIONS = SYNTHETIC_ANALYTICS.questions;
export const SYNTHETIC_EVENTS = SYNTHETIC_ANALYTICS.events;

export interface DateRange {
  /** YYYY-MM-DD or an ISO timestamp. Dates are interpreted in Asia/Seoul. */
  start: string;
  /** Inclusive. YYYY-MM-DD includes that entire calendar day. */
  end: string;
}

export interface AnalyticsFilter {
  dateRange?: DateRange;
  channels?: AcquisitionChannel[];
  platforms?: Platform[];
  devices?: DeviceType[];
  campaigns?: Campaign[];
  regions?: RegionBucket[];
  visitTypes?: VisitType[];
  lifecycleStages?: LifecycleStage[];
  intentCategories?: IntentCategory[];
  intentClusters?: IntentCluster[];
  engineVersions?: EngineVersion[];
  parserVersions?: ParserVersion[];
  qualityBands?: DataQualityBand[];
  decisions?: DecisionResult[];
  eventNames?: EventName[];
  productIds?: string[];
  reasonCodes?: string[];
  minimumBaselineDays?: number;
  maximumLatencyMs?: number;
}

export type AnalyticsGroupBy =
  | "channel"
  | "platform"
  | "device"
  | "campaign"
  | "regionBucket"
  | "visitType"
  | "lifecycleStage"
  | "intentCategory"
  | "intentCluster"
  | "engineVersion"
  | "parserVersion"
  | "dataQualityBand"
  | "decision"
  | "productId";

export const GROUP_BY_LABELS: Record<AnalyticsGroupBy, string> = {
  channel: "들어온 경로",
  platform: "이용 화면",
  device: "기기 종류",
  campaign: "유입 캠페인",
  regionBucket: "넓은 지역 구간",
  visitType: "첫 방문·재방문",
  lifecycleStage: "이용 단계",
  intentCategory: "질문 큰 분류",
  intentCluster: "구체적인 질문 목적",
  engineVersion: "판단 엔진 버전",
  parserVersion: "질문 분석기 버전",
  dataQualityBand: "비교할 기록 상태",
  decision: "사용자에게 보여준 안내",
  productId: "상품",
};

export const ANALYTICS_DICTIONARY = {
  events: EVENT_LABELS,
  eventDefinitions: EVENT_DEFINITIONS,
  fields: FIELD_LABELS,
  fieldDefinitions: FIELD_DEFINITIONS,
  values: VALUE_LABELS,
  groupBy: GROUP_BY_LABELS,
  judgmentOutcomes: JUDGMENT_OUTCOME_LABELS,
  productCategories: PRODUCT_CATEGORY_LABELS,
  reasons: REASON_LABELS,
} as const;

function listIncludes<T>(filterValues: readonly T[] | undefined, value: T): boolean {
  return !filterValues || filterValues.length === 0 || filterValues.includes(value);
}

function boundaryMs(value: string, isEnd: boolean): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return Date.parse(`${value}T${isEnd ? "23:59:59.999" : "00:00:00.000"}+09:00`);
  }
  return Date.parse(value);
}

function inDateRange(timestamp: string, range: DateRange | undefined): boolean {
  if (!range) return true;
  const value = Date.parse(timestamp);
  const start = boundaryMs(range.start, false);
  const end = boundaryMs(range.end, true);
  return Number.isFinite(value) && value >= start && value <= end;
}

function contextMatches(context: QuestionContext, filter: AnalyticsFilter): boolean {
  return listIncludes(filter.channels, context.channel)
    && listIncludes(filter.platforms, context.platform)
    && listIncludes(filter.devices, context.device)
    && listIncludes(filter.campaigns, context.campaign)
    && listIncludes(filter.regions, context.regionBucket)
    && listIncludes(filter.visitTypes, context.visitType)
    && listIncludes(filter.lifecycleStages, context.lifecycleStage)
    && listIncludes(filter.intentCategories, context.intentCategory)
    && listIncludes(filter.intentClusters, context.intentCluster)
    && listIncludes(filter.engineVersions, context.engineVersion)
    && listIncludes(filter.parserVersions, context.parserVersion)
    && listIncludes(filter.qualityBands, context.dataQualityBand)
    && (filter.minimumBaselineDays === undefined || context.baselineDays >= filter.minimumBaselineDays)
    && (filter.maximumLatencyMs === undefined || context.totalLatencyMs <= filter.maximumLatencyMs);
}

export function filterQuestions(
  questions: readonly QuestionJourney[],
  filter: AnalyticsFilter = {},
): QuestionJourney[] {
  return questions.filter((question) => {
    if (!inDateRange(question.startedAt, filter.dateRange)) return false;
    if (!contextMatches(question.context, filter)) return false;
    if (!listIncludes(filter.decisions, question.decision)) return false;
    if (filter.reasonCodes?.length && !filter.reasonCodes.some((code) => question.reasonCodes.includes(code))) return false;
    if (filter.productIds?.length) {
      const relatedProducts = new Set([
        ...question.candidateProductIds,
        ...question.exposedProductIds,
        ...(question.clickedProductId ? [question.clickedProductId] : []),
      ]);
      if (!filter.productIds.some((productId) => relatedProducts.has(productId))) return false;
    }
    return true;
  });
}

export function filterEvents(
  events: readonly AnalyticsEvent[],
  filter: AnalyticsFilter = {},
): AnalyticsEvent[] {
  return events.filter((event) => {
    if (!inDateRange(event.timestamp, filter.dateRange)) return false;
    if (!contextMatches(event.context, filter)) return false;
    if (!listIncludes(filter.eventNames, event.name)) return false;
    if (!listIncludes(filter.decisions, event.context.decision)) return false;
    if (filter.productIds?.length) {
      const direct = event.properties.productId;
      const collection = event.properties.productIds ?? [];
      if ((!direct || !filter.productIds.includes(direct)) && !collection.some((id) => filter.productIds?.includes(id))) return false;
    }
    if (filter.reasonCodes?.length && !filter.reasonCodes.some((code) => event.properties.reasonCodes?.includes(code))) return false;
    return true;
  });
}

export function percentile(values: readonly number[], quantile: number): number {
  const sorted = values.filter(Number.isFinite).slice().sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const q = clamp(quantile, 0, 1);
  const position = (sorted.length - 1) * q;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const fraction = position - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * fraction;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: 0.95;
}

export function wilsonConfidenceInterval(successes: number, total: number): ConfidenceInterval {
  if (total <= 0) return { lower: 0, upper: 0, confidence: 0.95 };
  const boundedSuccesses = clamp(successes, 0, total);
  const proportion = boundedSuccesses / total;
  const z = 1.959963984540054;
  const denominator = 1 + (z * z) / total;
  const center = (proportion + (z * z) / (2 * total)) / denominator;
  const margin = z * Math.sqrt((proportion * (1 - proportion) + (z * z) / (4 * total)) / total) / denominator;
  return { lower: clamp(center - margin, 0, 1), upper: clamp(center + margin, 0, 1), confidence: 0.95 };
}

export function meanConfidenceInterval(values: readonly number[]): ConfidenceInterval {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { lower: 0, upper: 0, confidence: 0.95 };
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  if (finite.length === 1) return { lower: mean, upper: mean, confidence: 0.95 };
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (finite.length - 1);
  const margin = 1.959963984540054 * Math.sqrt(variance / finite.length);
  return { lower: mean - margin, upper: mean + margin, confidence: 0.95 };
}

function groupValue(
  groupBy: AnalyticsGroupBy | undefined,
  event: AnalyticsEvent,
  questionById?: ReadonlyMap<string, QuestionJourney>,
): string {
  if (!groupBy) return "전체";
  if (groupBy === "decision") return questionById?.get(event.questionId)?.decision ?? event.context.decision;
  if (groupBy === "productId") return event.properties.productId ?? "no_product";
  return String(event.context[groupBy]);
}

export interface FunnelStageResult {
  eventName: EventName;
  label: string;
  count: number;
  conversionFromStart: number;
  conversionFromPrevious: number;
  dropOffFromPrevious: number;
  medianTimeFromPreviousMs: number | null;
  confidenceInterval: ConfidenceInterval;
}

export interface FunnelSeries {
  group: string;
  enteringQuestions: number;
  stages: FunnelStageResult[];
}

export interface OrderedFunnelResult {
  steps: EventName[];
  series: FunnelSeries[];
  analyzedQuestionCount: number;
  synthetic: true;
}

export interface OrderedFunnelOptions {
  steps: EventName[];
  filter?: AnalyticsFilter;
  breakdownBy?: Exclude<AnalyticsGroupBy, "productId">;
  conversionWindowDays?: number;
}

export function queryOrderedFunnel(
  events: readonly AnalyticsEvent[],
  options: OrderedFunnelOptions,
): OrderedFunnelResult {
  const filtered = filterEvents(events, { ...options.filter, eventNames: undefined, decisions: undefined, productIds: undefined });
  const byQuestion = new Map<string, AnalyticsEvent[]>();
  filtered.forEach((event) => {
    const collection = byQuestion.get(event.questionId);
    if (collection) collection.push(event);
    else byQuestion.set(event.questionId, [event]);
  });

  const byGroup = new Map<string, AnalyticsEvent[][]>();
  byQuestion.forEach((questionEvents) => {
    questionEvents.sort((left, right) => left.sequence - right.sequence || left.timestamp.localeCompare(right.timestamp));
    const group = groupValue(options.breakdownBy, questionEvents[0]);
    const collection = byGroup.get(group);
    if (collection) collection.push(questionEvents);
    else byGroup.set(group, [questionEvents]);
  });

  const conversionWindowMs = (options.conversionWindowDays ?? 30) * DAY_MS;
  const series: FunnelSeries[] = [];
  byGroup.forEach((questionGroups, group) => {
    const counts = options.steps.map(() => 0);
    const durations = options.steps.map(() => [] as number[]);
    questionGroups.forEach((questionEvents) => {
      let cursor = -1;
      let firstTimestamp = 0;
      let previousTimestamp = 0;
      for (let stepIndex = 0; stepIndex < options.steps.length; stepIndex += 1) {
        const wanted = options.steps[stepIndex];
        const matchIndex = questionEvents.findIndex((event, index) => index > cursor && event.name === wanted);
        if (matchIndex < 0) break;
        const timestamp = Date.parse(questionEvents[matchIndex].timestamp);
        if (stepIndex === 0) firstTimestamp = timestamp;
        if (timestamp - firstTimestamp > conversionWindowMs) break;
        counts[stepIndex] += 1;
        if (stepIndex > 0) durations[stepIndex].push(timestamp - previousTimestamp);
        previousTimestamp = timestamp;
        cursor = matchIndex;
      }
    });
    const startCount = counts[0] ?? 0;
    series.push({
      group,
      enteringQuestions: questionGroups.length,
      stages: options.steps.map((eventName, index) => {
        const previousCount = index === 0 ? questionGroups.length : counts[index - 1];
        return {
          eventName,
          label: EVENT_LABELS[eventName],
          count: counts[index],
          conversionFromStart: startCount > 0 ? counts[index] / startCount : 0,
          conversionFromPrevious: previousCount > 0 ? counts[index] / previousCount : 0,
          dropOffFromPrevious: index === 0 ? 0 : previousCount - counts[index],
          medianTimeFromPreviousMs: index === 0 || durations[index].length === 0 ? null : Math.round(percentile(durations[index], 0.5)),
          confidenceInterval: wilsonConfidenceInterval(counts[index], Math.max(startCount, 1)),
        };
      }),
    });
  });

  series.sort((left, right) => right.enteringQuestions - left.enteringQuestions || left.group.localeCompare(right.group));
  return { steps: options.steps, series, analyzedQuestionCount: byQuestion.size, synthetic: true };
}

export type TimeInterval = "day" | "week" | "month";
export type TimeSeriesMetric = "event_count" | "unique_questions" | "unique_users";

export interface TimeSeriesPoint {
  date: string;
  group: string;
  value: number;
}

export interface TimeSeriesOptions {
  filter?: AnalyticsFilter;
  eventNames?: EventName[];
  interval?: TimeInterval;
  groupBy?: AnalyticsGroupBy;
  metric?: TimeSeriesMetric;
}

function timeBucket(timestamp: string, interval: TimeInterval): string {
  const epochMs = Date.parse(timestamp);
  const shifted = new Date(epochMs + KST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  if (interval === "month") return `${year}-${String(month + 1).padStart(2, "0")}-01`;
  if (interval === "week") {
    const day = shifted.getUTCDay();
    const daysSinceMonday = (day + 6) % 7;
    return kstDate(epochMs - daysSinceMonday * DAY_MS);
  }
  return kstDate(epochMs);
}

export function queryTimeSeries(
  events: readonly AnalyticsEvent[],
  options: TimeSeriesOptions = {},
): TimeSeriesPoint[] {
  const interval = options.interval ?? "day";
  const metric = options.metric ?? "event_count";
  const filtered = filterEvents(events, {
    ...options.filter,
    eventNames: options.eventNames ?? options.filter?.eventNames,
  });
  const buckets = new Map<string, { count: number; questions: Set<string>; users: Set<string> }>();
  filtered.forEach((event) => {
    const date = timeBucket(event.timestamp, interval);
    const group = groupValue(options.groupBy, event);
    const key = `${date}\u0000${group}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, questions: new Set<string>(), users: new Set<string>() };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    bucket.questions.add(event.questionId);
    bucket.users.add(event.anonymousUserId);
  });
  return Array.from(buckets.entries()).map(([key, bucket]) => {
    const [date, group] = key.split("\u0000");
    const value = metric === "event_count" ? bucket.count : metric === "unique_questions" ? bucket.questions.size : bucket.users.size;
    return { date, group, value };
  }).sort((left, right) => left.date.localeCompare(right.date) || left.group.localeCompare(right.group));
}

export interface JourneyNode {
  eventName: EventName;
  label: string;
  questionCount: number;
  userCount: number;
}

export interface JourneyTransition {
  from: EventName;
  to: EventName;
  fromLabel: string;
  toLabel: string;
  count: number;
  shareOfSource: number;
  uniqueUsers: number;
  medianTransitionMs: number;
}

export interface JourneyTransitionResult {
  nodes: JourneyNode[];
  links: JourneyTransition[];
  analyzedQuestionCount: number;
  synthetic: true;
}

export interface JourneyTransitionOptions {
  filter?: AnalyticsFilter;
  startEvent?: EventName;
  endEvent?: EventName;
  maximumSteps?: number;
  minimumTransitionCount?: number;
  collapseRepeatedEvents?: boolean;
}

export function queryJourneyTransitions(
  events: readonly AnalyticsEvent[],
  options: JourneyTransitionOptions = {},
): JourneyTransitionResult {
  const filtered = filterEvents(events, { ...options.filter, eventNames: undefined, decisions: undefined, productIds: undefined });
  const byQuestion = new Map<string, AnalyticsEvent[]>();
  filtered.forEach((event) => {
    const collection = byQuestion.get(event.questionId);
    if (collection) collection.push(event);
    else byQuestion.set(event.questionId, [event]);
  });

  const nodeQuestions = new Map<EventName, Set<string>>();
  const nodeUsers = new Map<EventName, Set<string>>();
  const links = new Map<string, { from: EventName; to: EventName; questions: Set<string>; users: Set<string>; durations: number[] }>();
  const maximumSteps = options.maximumSteps ?? 16;

  byQuestion.forEach((questionEvents, questionId) => {
    questionEvents.sort((left, right) => left.sequence - right.sequence || left.timestamp.localeCompare(right.timestamp));
    let path = questionEvents;
    if (options.startEvent) {
      const index = path.findIndex((event) => event.name === options.startEvent);
      if (index < 0) return;
      path = path.slice(index);
    }
    if (options.endEvent) {
      const index = path.findIndex((event) => event.name === options.endEvent);
      if (index >= 0) path = path.slice(0, index + 1);
    }
    if (options.collapseRepeatedEvents ?? true) {
      path = path.filter((event, index) => index === 0 || event.name !== path[index - 1].name);
    }
    path = path.slice(0, maximumSteps);
    path.forEach((event) => {
      if (!nodeQuestions.has(event.name)) nodeQuestions.set(event.name, new Set<string>());
      if (!nodeUsers.has(event.name)) nodeUsers.set(event.name, new Set<string>());
      nodeQuestions.get(event.name)?.add(questionId);
      nodeUsers.get(event.name)?.add(event.anonymousUserId);
    });
    for (let index = 1; index < path.length; index += 1) {
      const from = path[index - 1];
      const to = path[index];
      const key = `${from.name}>${to.name}`;
      let link = links.get(key);
      if (!link) {
        link = { from: from.name, to: to.name, questions: new Set<string>(), users: new Set<string>(), durations: [] };
        links.set(key, link);
      }
      link.questions.add(questionId);
      link.users.add(from.anonymousUserId);
      link.durations.push(Math.max(0, Date.parse(to.timestamp) - Date.parse(from.timestamp)));
    }
  });

  const sourceTotals = new Map<EventName, number>();
  links.forEach((link) => sourceTotals.set(link.from, (sourceTotals.get(link.from) ?? 0) + link.questions.size));
  const minimum = options.minimumTransitionCount ?? 1;
  return {
    nodes: Array.from(nodeQuestions.entries()).map(([eventName, questionIds]) => ({
      eventName,
      label: EVENT_LABELS[eventName],
      questionCount: questionIds.size,
      userCount: nodeUsers.get(eventName)?.size ?? 0,
    })).sort((left, right) => right.questionCount - left.questionCount),
    links: Array.from(links.values()).filter((link) => link.questions.size >= minimum).map((link) => ({
      from: link.from,
      to: link.to,
      fromLabel: EVENT_LABELS[link.from],
      toLabel: EVENT_LABELS[link.to],
      count: link.questions.size,
      shareOfSource: link.questions.size / Math.max(sourceTotals.get(link.from) ?? 1, 1),
      uniqueUsers: link.users.size,
      medianTransitionMs: Math.round(percentile(link.durations, 0.5)),
    })).sort((left, right) => right.count - left.count),
    analyzedQuestionCount: byQuestion.size,
    synthetic: true,
  };
}

export type CohortPropertyField =
  | AnalyticsGroupBy
  | "baselineDays"
  | "dataCompleteness"
  | "clarificationCount"
  | "totalLatencyMs"
  | "safetyResult"
  | "questionNumberForUser"
  | "returnedWithin14Days";

export type CohortPropertyOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "greater_than"
  | "greater_or_equal"
  | "less_than"
  | "less_or_equal"
  | "between";

export interface CohortPropertyRule {
  kind: "property";
  field: CohortPropertyField;
  operator: CohortPropertyOperator;
  value: string | number | boolean | Array<string | number | boolean>;
}

export interface CohortBehaviorRule {
  kind: "behavior";
  eventName: EventName;
  operator: "did" | "did_not";
  minimumCount?: number;
  productId?: string;
}

export type CohortRule = CohortPropertyRule | CohortBehaviorRule;

export interface CohortRuleGroup {
  logic: "and" | "or";
  rules: CohortRule[];
}

export interface CohortDefinition {
  id: string;
  name: string;
  description?: string;
  groupLogic: "and" | "or";
  groups: CohortRuleGroup[];
}

function cohortProperty(question: QuestionJourney, field: CohortPropertyField): string | number | boolean {
  switch (field) {
    case "decision": return question.decision;
    case "productId": return question.clickedProductId ?? question.exposedProductIds[0] ?? "no_product";
    case "baselineDays": return question.context.baselineDays;
    case "dataCompleteness": return question.context.dataCompleteness;
    case "clarificationCount": return question.context.clarificationCount;
    case "totalLatencyMs": return question.context.totalLatencyMs;
    case "safetyResult": return question.safetyResult;
    case "questionNumberForUser": return question.questionNumberForUser;
    case "returnedWithin14Days": return question.returnedWithin14Days;
    default: return question.context[field];
  }
}

function propertyRuleMatches(question: QuestionJourney, rule: CohortPropertyRule): boolean {
  const actual = cohortProperty(question, rule.field);
  const values = Array.isArray(rule.value) ? rule.value : [rule.value];
  switch (rule.operator) {
    case "equals": return actual === values[0];
    case "not_equals": return actual !== values[0];
    case "in": return values.includes(actual);
    case "not_in": return !values.includes(actual);
    case "greater_than": return typeof actual === "number" && typeof values[0] === "number" && actual > values[0];
    case "greater_or_equal": return typeof actual === "number" && typeof values[0] === "number" && actual >= values[0];
    case "less_than": return typeof actual === "number" && typeof values[0] === "number" && actual < values[0];
    case "less_or_equal": return typeof actual === "number" && typeof values[0] === "number" && actual <= values[0];
    case "between": return typeof actual === "number" && typeof values[0] === "number" && typeof values[1] === "number" && actual >= values[0] && actual <= values[1];
  }
}

/**
 * Compiles a saved cohort definition into a reusable question predicate.
 * Property and behavior conditions can be mixed with nested AND/OR groups.
 */
export function createCohortPredicate(
  definition: CohortDefinition,
  events: readonly AnalyticsEvent[],
): (question: QuestionJourney) => boolean {
  const eventsByQuestion = new Map<string, AnalyticsEvent[]>();
  events.forEach((event) => {
    const collection = eventsByQuestion.get(event.questionId);
    if (collection) collection.push(event);
    else eventsByQuestion.set(event.questionId, [event]);
  });
  const ruleMatches = (question: QuestionJourney, rule: CohortRule): boolean => {
    if (rule.kind === "property") return propertyRuleMatches(question, rule);
    const matchingCount = (eventsByQuestion.get(question.questionId) ?? []).filter((event) => {
      if (event.name !== rule.eventName) return false;
      if (!rule.productId) return true;
      return event.properties.productId === rule.productId || event.properties.productIds?.includes(rule.productId);
    }).length;
    const performed = matchingCount >= (rule.minimumCount ?? 1);
    return rule.operator === "did" ? performed : !performed;
  };
  return (question: QuestionJourney): boolean => {
    const groupResults = definition.groups.map((group) => {
      const results = group.rules.map((rule) => ruleMatches(question, rule));
      return group.logic === "and" ? results.every(Boolean) : results.some(Boolean);
    });
    return definition.groupLogic === "and" ? groupResults.every(Boolean) : groupResults.some(Boolean);
  };
}

export function filterByCohort(
  questions: readonly QuestionJourney[],
  events: readonly AnalyticsEvent[],
  definition: CohortDefinition,
): QuestionJourney[] {
  const predicate = createCohortPredicate(definition, events);
  return questions.filter(predicate);
}

export interface ProductPerformanceRow {
  productId: string;
  name: string;
  category: ProductCategory;
  evaluatedQuestions: number;
  eligibleQuestions: number;
  excludedQuestions: number;
  reviewQuestions: number;
  eligibilityRate: number;
  averageEligibleScore: number;
  medianEligibleScore: number;
  impressions: number;
  evidenceOpens: number;
  clicks: number;
  clickThroughRate: number;
  clickThroughConfidenceInterval: ConfidenceInterval;
  returnedWithin14Days: number;
  returnRateAfterClick: number;
  topReasonCodes: Array<{ reasonCode: string; count: number }>;
  synthetic: true;
}

export function queryProductPerformance(
  dataset: Pick<SyntheticAnalyticsDataset, "questions" | "events" | "products">,
  filter: AnalyticsFilter = {},
): ProductPerformanceRow[] {
  const matchingQuestions = filterQuestions(dataset.questions, filter);
  const questionIds = new Set(matchingQuestions.map((question) => question.questionId));
  const matchingEvents = filterEvents(dataset.events, {
    ...filter,
    decisions: undefined,
    productIds: undefined,
    eventNames: undefined,
  }).filter((event) => questionIds.has(event.questionId));

  return dataset.products.map((product) => {
    const evaluations = matchingEvents.filter((event) => event.name === "candidate_evaluated" && event.properties.productId === product.productId);
    const eligible = evaluations.filter((event) => event.properties.candidateStatus === "eligible");
    const excluded = evaluations.filter((event) => event.properties.candidateStatus === "excluded");
    const reviews = evaluations.filter((event) => event.properties.candidateStatus === "needs_review");
    const impressions = matchingEvents.filter((event) => event.name === "recommendation_shown" && event.properties.productId === product.productId);
    const evidenceOpens = matchingEvents.filter((event) => event.name === "evidence_opened" && event.properties.productId === product.productId);
    const clicks = matchingEvents.filter((event) => event.name === "product_clicked" && event.properties.productId === product.productId);
    const scores = eligible.map((event) => event.properties.productScore).filter((score): score is number => score !== undefined);
    const clickedQuestions = matchingQuestions.filter((question) => question.clickedProductId === product.productId);
    const returned = clickedQuestions.filter((question) => question.returnedWithin14Days).length;
    const reasonCounts = new Map<string, number>();
    evaluations.forEach((event) => event.properties.reasonCodes?.forEach((reasonCode) => {
      reasonCounts.set(reasonCode, (reasonCounts.get(reasonCode) ?? 0) + 1);
    }));
    return {
      productId: product.productId,
      name: product.name,
      category: product.category,
      evaluatedQuestions: evaluations.length,
      eligibleQuestions: eligible.length,
      excludedQuestions: excluded.length,
      reviewQuestions: reviews.length,
      eligibilityRate: evaluations.length > 0 ? eligible.length / evaluations.length : 0,
      averageEligibleScore: scores.length > 0 ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length, 1) : 0,
      medianEligibleScore: round(percentile(scores, 0.5), 1),
      impressions: impressions.length,
      evidenceOpens: evidenceOpens.length,
      clicks: clicks.length,
      clickThroughRate: impressions.length > 0 ? clicks.length / impressions.length : 0,
      clickThroughConfidenceInterval: wilsonConfidenceInterval(clicks.length, impressions.length),
      returnedWithin14Days: returned,
      returnRateAfterClick: clickedQuestions.length > 0 ? returned / clickedQuestions.length : 0,
      topReasonCodes: Array.from(reasonCounts.entries()).map(([reasonCode, count]) => ({ reasonCode, count })).sort((left, right) => right.count - left.count).slice(0, 4),
      synthetic: true as const,
    };
  }).filter((row) => !filter.productIds?.length || filter.productIds.includes(row.productId))
    .sort((left, right) => right.impressions - left.impressions || right.evaluatedQuestions - left.evaluatedQuestions);
}

export type KpiId =
  | "questions"
  | "unique_users"
  | "information_completion_rate"
  | "safety_stop_rate"
  | "product_exposure_rate"
  | "evidence_open_rate"
  | "product_click_rate"
  | "return_within_14d_rate"
  | "median_latency_ms"
  | "p95_latency_ms";

export interface KpiResult {
  id: KpiId;
  label: string;
  definition: string;
  format: "count" | "percent" | "milliseconds";
  value: number;
  previousValue: number;
  absoluteChange: number;
  relativeChange: number | null;
  numerator: number;
  denominator: number;
  confidenceInterval: ConfidenceInterval | null;
}

export interface KpiQueryOptions {
  dateRange?: DateRange;
  filter?: AnalyticsFilter;
}

export function previousDateRange(range: DateRange): DateRange {
  const start = boundaryMs(range.start, false);
  const end = boundaryMs(range.end, true);
  const inclusiveDuration = end - start + 1;
  const previousEnd = start - 1;
  const previousStart = previousEnd - inclusiveDuration + 1;
  return { start: kstDate(previousStart), end: kstDate(previousEnd) };
}

interface MetricSnapshot {
  questions: number;
  uniqueUsers: number;
  informationCompleted: number;
  safetyStops: number;
  productExposures: number;
  evidenceOpened: number;
  productClicks: number;
  returnEligible: number;
  returnsWithin14d: number;
  medianLatency: number;
  p95Latency: number;
}

function metricSnapshot(
  questions: readonly QuestionJourney[],
  events: readonly AnalyticsEvent[],
  rangeEnd: string,
): MetricSnapshot {
  const questionIds = new Set(questions.map((question) => question.questionId));
  const relevantEvents = events.filter((event) => questionIds.has(event.questionId));
  const eventQuestionCount = (name: EventName): number => new Set(relevantEvents.filter((event) => event.name === name).map((event) => event.questionId)).size;
  const rangeEndMs = boundaryMs(rangeEnd, true);
  const returnEligibleQuestions = questions.filter((question) => Date.parse(question.startedAt) <= rangeEndMs - 14 * DAY_MS);
  return {
    questions: questions.length,
    uniqueUsers: new Set(questions.map((question) => question.anonymousUserId)).size,
    informationCompleted: eventQuestionCount("information_completed"),
    safetyStops: questions.filter((question) => question.decision === "safety_stop").length,
    productExposures: questions.filter((question) => question.exposedProductIds.length > 0).length,
    evidenceOpened: questions.filter((question) => question.evidenceOpenedProductId !== null).length,
    productClicks: questions.filter((question) => question.clickedProductId !== null).length,
    returnEligible: returnEligibleQuestions.length,
    returnsWithin14d: returnEligibleQuestions.filter((question) => question.returnedWithin14Days).length,
    medianLatency: percentile(questions.map((question) => question.context.totalLatencyMs), 0.5),
    p95Latency: percentile(questions.map((question) => question.context.totalLatencyMs), 0.95),
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function queryKpis(
  dataset: Pick<SyntheticAnalyticsDataset, "questions" | "events">,
  options: KpiQueryOptions = {},
): KpiResult[] {
  const dateRange = options.dateRange ?? { start: "2026-09-06", end: DATASET_WINDOW.end };
  const previousRange = previousDateRange(dateRange);
  const currentFilter = { ...options.filter, dateRange };
  const previousFilter = { ...options.filter, dateRange: previousRange };
  const currentQuestions = filterQuestions(dataset.questions, currentFilter);
  const previousQuestions = filterQuestions(dataset.questions, previousFilter);
  const currentQuestionIds = new Set(currentQuestions.map((question) => question.questionId));
  const previousQuestionIds = new Set(previousQuestions.map((question) => question.questionId));
  const currentEvents = filterEvents(dataset.events, { ...currentFilter, decisions: undefined, productIds: undefined, eventNames: undefined })
    .filter((event) => currentQuestionIds.has(event.questionId));
  const previousEvents = filterEvents(dataset.events, { ...previousFilter, decisions: undefined, productIds: undefined, eventNames: undefined })
    .filter((event) => previousQuestionIds.has(event.questionId));
  const current = metricSnapshot(currentQuestions, currentEvents, dateRange.end);
  const previous = metricSnapshot(previousQuestions, previousEvents, previousRange.end);

  const specs: Array<{
    id: KpiId;
    label: string;
    definition: string;
    format: KpiResult["format"];
    currentValue: number;
    previousValue: number;
    numerator: number;
    denominator: number;
    isRate?: boolean;
  }> = [
    { id: "questions", label: "질문 수", definition: "선택한 기간에 시작된 질문 흐름 수", format: "count", currentValue: current.questions, previousValue: previous.questions, numerator: current.questions, denominator: 1 },
    { id: "unique_users", label: "질문한 사람", definition: "선택한 기간에 질문한 중복 제거 익명 사용자 수", format: "count", currentValue: current.uniqueUsers, previousValue: previous.uniqueUsers, numerator: current.uniqueUsers, denominator: 1 },
    { id: "information_completion_rate", label: "필요 정보 확인 완료율", definition: "질문 중 판단에 필요한 정보가 모두 확인된 비율", format: "percent", currentValue: ratio(current.informationCompleted, current.questions), previousValue: ratio(previous.informationCompleted, previous.questions), numerator: current.informationCompleted, denominator: current.questions, isRate: true },
    { id: "safety_stop_rate", label: "안전 안내 전환율", definition: "위험 신호 때문에 상품 탐색을 멈추고 안전 안내로 전환된 비율", format: "percent", currentValue: ratio(current.safetyStops, current.questions), previousValue: ratio(previous.safetyStops, previous.questions), numerator: current.safetyStops, denominator: current.questions, isRate: true },
    { id: "product_exposure_rate", label: "적격 상품 노출률", definition: "질문 중 필수 조건을 통과한 상품이 하나 이상 실제로 보인 비율", format: "percent", currentValue: ratio(current.productExposures, current.questions), previousValue: ratio(previous.productExposures, previous.questions), numerator: current.productExposures, denominator: current.questions, isRate: true },
    { id: "evidence_open_rate", label: "선정 근거 열람률", definition: "상품이 보인 질문 중 사용자가 선정 근거를 연 비율", format: "percent", currentValue: ratio(current.evidenceOpened, current.productExposures), previousValue: ratio(previous.evidenceOpened, previous.productExposures), numerator: current.evidenceOpened, denominator: current.productExposures, isRate: true },
    { id: "product_click_rate", label: "상품 상세 클릭률", definition: "상품이 보인 질문 중 하나 이상 상세 정보를 누른 비율", format: "percent", currentValue: ratio(current.productClicks, current.productExposures), previousValue: ratio(previous.productClicks, previous.productExposures), numerator: current.productClicks, denominator: current.productExposures, isRate: true },
    { id: "return_within_14d_rate", label: "14일 안 재방문율", definition: "관찰 기간이 14일 이상 확보된 질문 중 같은 익명 사용자가 다시 온 비율", format: "percent", currentValue: ratio(current.returnsWithin14d, current.returnEligible), previousValue: ratio(previous.returnsWithin14d, previous.returnEligible), numerator: current.returnsWithin14d, denominator: current.returnEligible, isRate: true },
    { id: "median_latency_ms", label: "결과 대기 시간 중앙값", definition: "질문의 절반이 이 시간 안에 최종 안내까지 도달함", format: "milliseconds", currentValue: current.medianLatency, previousValue: previous.medianLatency, numerator: current.medianLatency, denominator: 1 },
    { id: "p95_latency_ms", label: "느린 5% 경계 시간", definition: "질문의 95%가 이 시간 안에 최종 안내까지 도달함", format: "milliseconds", currentValue: current.p95Latency, previousValue: previous.p95Latency, numerator: current.p95Latency, denominator: 1 },
  ];

  return specs.map((spec) => ({
    id: spec.id,
    label: spec.label,
    definition: spec.definition,
    format: spec.format,
    value: spec.currentValue,
    previousValue: spec.previousValue,
    absoluteChange: spec.currentValue - spec.previousValue,
    relativeChange: spec.previousValue === 0 ? null : (spec.currentValue - spec.previousValue) / Math.abs(spec.previousValue),
    numerator: spec.numerator,
    denominator: spec.denominator,
    confidenceInterval: spec.isRate ? wilsonConfidenceInterval(spec.numerator, spec.denominator) : null,
  }));
}
