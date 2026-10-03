"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChoiceMenu,
  CurvedFunnel,
  DateRangeControl,
  EmptyState,
  Icon,
  JourneySankey,
  MetricCard,
  TimeSeriesChart,
  type DateRangeValue,
  type FunnelStage,
  type JourneyLink,
  type JourneyNode,
  type LineSeries,
  type MenuOption,
} from "./components/AnalyticsUI";
import {
  DATASET_WINDOW,
  EVENT_DEFINITIONS,
  EVENT_LABELS,
  FIELD_DEFINITIONS,
  FIELD_LABELS,
  PRODUCT_CATALOG,
  SYNTHETIC_DATA_NOTICE,
  SYNTHETIC_EVENTS,
  SYNTHETIC_QUESTIONS,
  VALUE_LABELS,
  type AnalyticsEvent,
  type EventName,
  type QuestionJourney,
} from "./lib/analytics";

type ViewId = "home" | "questions" | "funnel" | "journeys" | "cohorts" | "products" | "sessions" | "insights" | "data";
type SegmentId = "all" | "mobile" | "returning" | "short_baseline" | "organic" | "product_shown";
type GroupId = "intentCluster" | "channel" | "device" | "decision";
type MeasureId = "questions" | "users" | "completion_rate" | "exposure_rate";
type FilterField = "device" | "visit" | "baseline" | "channel" | "exposure";
type FilterLogic = "all" | "any";
type FilterRule = { id: string; field: FilterField; value: string };

type CohortRule = { id: string; field: "intent" | "baseline" | "device" | "decision" | "event"; operator: "is" | "lt" | "performed"; value: string };
type SavedCohort = { id: string; name: string; description: string; size: number; change: number; type: "동적" | "스냅샷" | "경로"; owner: string; updated: string; privacyReady: boolean };

const NAV: Array<{ label: string; items: Array<{ id: ViewId | "engine"; label: string; icon: string; note?: string }> }> = [
  { label: "작업", items: [
    { id: "home", label: "홈", icon: "home" },
    { id: "insights", label: "인사이트", icon: "bulb", note: "3" },
  ] },
  { label: "분석", items: [
    { id: "questions", label: "질문 분석", icon: "chart" },
    { id: "funnel", label: "전환", icon: "funnel" },
    { id: "journeys", label: "여정", icon: "journey" },
    { id: "cohorts", label: "고객 그룹", icon: "users" },
    { id: "products", label: "상품", icon: "box" },
    { id: "sessions", label: "질문 기록", icon: "list" },
  ] },
  { label: "관리", items: [
    { id: "data", label: "데이터", icon: "database" },
    { id: "engine", label: "판단 엔진", icon: "engine" },
  ] },
];

const VIEW_COPY: Record<ViewId, { title: string; subtitle: string }> = {
  home: { title: "브랜드 성과", subtitle: "질문에서 안내와 상품 행동까지, 같은 이벤트 원장으로 계산한 30일 요약" },
  questions: { title: "질문 분석", subtitle: "질문 시작 이벤트 · 고유 질문 수 · 질문 목적별" },
  funnel: { title: "전환", subtitle: "질문 시작 → 정보 확인 → 안전 확인 → 적격 상품 노출" },
  journeys: { title: "여정", subtitle: "질문 시작 이후 실제로 이어진 행동 경로" },
  cohorts: { title: "고객 그룹", subtitle: "행동과 조건으로 저장한 익명 사용자 집합" },
  products: { title: "상품", subtitle: "후보 평가, 적격 판정, 실제 노출과 상세 이동" },
  sessions: { title: "질문 기록", subtitle: "개인 건강 원문을 제외한 이벤트 처리 순서" },
  insights: { title: "인사이트", subtitle: "변화, 영향을 준 집단, 해석할 때의 한계" },
  data: { title: "데이터", subtitle: "이벤트 정의, 수집 상태, 버전과 개인정보 경계" },
};

const SEGMENT_OPTIONS: MenuOption[] = [
  { value: "all", label: "모든 질문", description: "선택 기간에 시작된 전체 익명 질문" },
  { value: "mobile", label: "모바일 질문", description: "모바일 기기에서 시작한 질문" },
  { value: "returning", label: "재방문 사용자", description: "이전에 한 번 이상 질문한 익명 사용자" },
  { value: "short_baseline", label: "기준 기록 28일 미만", description: "비교 가능한 같은 기기 기록이 짧은 질문" },
  { value: "organic", label: "자연 검색 유입", description: "검색 광고가 아닌 자연 검색에서 시작" },
  { value: "product_shown", label: "적격 상품을 본 질문", description: "필수 조건을 통과한 상품이 실제 노출됨" },
];

const GROUP_OPTIONS: MenuOption[] = [
  { value: "intentCluster", label: "구체적인 질문 목적", description: "식사량 감소, 단백질 선택, 안전 확인 등" },
  { value: "channel", label: "처음 들어온 경로", description: "자연 검색, 광고, 직접 방문 등" },
  { value: "device", label: "기기 종류", description: "모바일, 데스크톱, 태블릿" },
  { value: "decision", label: "사용자에게 보여준 안내", description: "상품, 음식 우선, 안전 안내 등" },
];

const MEASURE_OPTIONS: MenuOption[] = [
  { value: "questions", label: "고유 질문 수", description: "질문 처리 ID를 중복 없이 셉니다." },
  { value: "users", label: "익명 사용자 수", description: "같은 익명 사용자는 한 번만 셉니다." },
  { value: "completion_rate", label: "필요 정보 확인 완료율", description: "질문 시작 중 판단에 필요한 정보가 모인 비율" },
  { value: "exposure_rate", label: "적격 상품 제안 노출률", description: "질문 시작 중 상품이 실제 화면에 나타난 비율" },
];

const INTERVAL_OPTIONS: MenuOption[] = [
  { value: "day", label: "일별" },
  { value: "week", label: "주별" },
];

const FILTER_FIELD_OPTIONS: MenuOption[] = [
  { value: "device", label: "기기 종류", description: "질문을 시작한 기기" },
  { value: "visit", label: "방문 상태", description: "첫 방문인지 재방문인지" },
  { value: "baseline", label: "비교 기록 길이", description: "같은 기기로 모은 기준 기록" },
  { value: "channel", label: "처음 들어온 경로", description: "질문 화면에 도착한 유입 경로" },
  { value: "exposure", label: "상품 노출 여부", description: "적격 상품이 실제로 보였는지" },
];

const FILTER_VALUE_OPTIONS: Record<FilterField, MenuOption[]> = {
  device: [
    { value: "mobile", label: "모바일" },
    { value: "desktop", label: "데스크톱" },
    { value: "tablet", label: "태블릿" },
  ],
  visit: [
    { value: "returning", label: "재방문" },
    { value: "new", label: "첫 방문" },
  ],
  baseline: [
    { value: "short", label: "28일 미만" },
    { value: "enough", label: "28일 이상" },
  ],
  channel: [
    { value: "organic_search", label: "자연 검색" },
    { value: "paid_search", label: "검색 광고" },
    { value: "direct", label: "직접 방문" },
    { value: "instagram", label: "인스타그램" },
    { value: "kakao", label: "카카오" },
    { value: "email", label: "이메일" },
    { value: "partner", label: "제휴 경로" },
  ],
  exposure: [
    { value: "shown", label: "적격 상품을 봄" },
    { value: "not_shown", label: "적격 상품을 보지 못함" },
  ],
};

const DEFAULT_COHORTS: SavedCohort[] = [
  { id: "C-01", name: "기준 기록이 짧아 판단이 보류된 사용자", description: "기준 기록 < 28일 AND 안내 = 정보 더 확인", size: 638, change: 18.2, type: "동적", owner: "마케팅팀", updated: "3분 전", privacyReady: true },
  { id: "C-02", name: "상품 근거를 열어본 재방문 사용자", description: "재방문 AND 적격 상품 노출 THEN 근거 열람", size: 412, change: 7.4, type: "경로", owner: "민지", updated: "7분 전", privacyReady: true },
  { id: "C-03", name: "상품을 봤지만 상세로 이동하지 않음", description: "상품 노출 AND NOT 상품 상세 클릭", size: 1568, change: -2.1, type: "동적", owner: "준호", updated: "12분 전", privacyReady: true },
  { id: "C-04", name: "안전 안내를 받은 소규모 집단", description: "안전 사유로 상품 흐름 중단", size: 18, change: 0, type: "스냅샷", owner: "데이터팀", updated: "1시간 전", privacyReady: false },
];

const REASON_LABELS: Record<string, string> = {
  MILK_INGREDIENT_CONFLICT: "우유 성분과 사용자 조건 충돌",
  INTERACTION_EVIDENCE_MISSING: "상호작용 확인 자료 없음",
  LABEL_REVIEW_DUE: "상품 라벨 확인 시점이 오래됨",
  RED_FLAG_PRESENT: "먼저 확인할 위험 신호 있음",
  REQUIRED_INFORMATION_INCOMPLETE: "판단에 필요한 정보가 아직 없음",
  BASELINE_TOO_SHORT: "비교할 기준 기록이 짧음",
  DEVICE_CHANGED: "기기가 바뀌어 직접 비교 불가",
  INTENT_MATCHED_CATEGORY: "질문 목적과 상품군이 일치함",
  ALL_REQUIRED_CONDITIONS_PASSED: "모든 필수 조건 통과",
  REQUIRED_CONDITIONS_PASSED: "모든 필수 조건 통과",
};

const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  protein_powder: "단백질 파우더",
  protein_drink: "단백질 음료",
  meal_supplement: "식사 보충",
};

const COLORS = ["#5d5ce2", "#208a75", "#e18a32", "#9a57c7", "#4479c4", "#c75468", "#77808f", "#16a3a3"];

function pct(part: number, whole: number) {
  return whole ? (part / whole) * 100 : 0;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function dayDifference(start: string, end: string) {
  return Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1);
}

function previousRange(date: DateRangeValue) {
  if (date.compare === "year") {
    const start = new Date(`${date.start}T00:00:00Z`);
    const end = new Date(`${date.end}T00:00:00Z`);
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    end.setUTCFullYear(end.getUTCFullYear() - 1);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  const days = dayDifference(date.start, date.end);
  const end = new Date(`${date.start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function ruleMatches(question: QuestionJourney, rule: FilterRule) {
  if (rule.field === "device") return question.context.device === rule.value;
  if (rule.field === "visit") return question.context.visitType === rule.value;
  if (rule.field === "baseline") return rule.value === "short" ? question.context.baselineDays < 28 : question.context.baselineDays >= 28;
  if (rule.field === "channel") return question.context.channel === rule.value;
  if (rule.field === "exposure") return rule.value === "shown" ? question.exposedProductIds.length > 0 : question.exposedProductIds.length === 0;
  return true;
}

function matchesRules(question: QuestionJourney, rules: FilterRule[], logic: FilterLogic) {
  if (!rules.length) return true;
  return logic === "all" ? rules.every((rule) => ruleMatches(question, rule)) : rules.some((rule) => ruleMatches(question, rule));
}

function segmentMatches(question: QuestionJourney, segment: SegmentId) {
  switch (segment) {
    case "mobile": return question.context.device === "mobile";
    case "returning": return question.context.visitType === "returning";
    case "short_baseline": return question.context.baselineDays < 28;
    case "organic": return question.context.channel === "organic_search";
    case "product_shown": return question.exposedProductIds.length > 0;
    default: return true;
  }
}

function filterQuestions(start: string, end: string, segment: SegmentId, rules: FilterRule[] = [], logic: FilterLogic = "all") {
  return SYNTHETIC_QUESTIONS.filter((question) => question.context.questionDate >= start && question.context.questionDate <= end && segmentMatches(question, segment) && matchesRules(question, rules, logic));
}

function questionEvents(questions: QuestionJourney[]) {
  const ids = new Set(questions.map((question) => question.questionId));
  return SYNTHETIC_EVENTS.filter((event) => ids.has(event.questionId));
}

function computeStats(questions: QuestionJourney[]) {
  const informationComplete = questions.filter((question) => !question.reasonCodes.includes("REQUIRED_INFORMATION_INCOMPLETE")).length;
  const safetyPassed = questions.filter((question) => question.safetyResult === "passed").length;
  const shown = questions.filter((question) => question.exposedProductIds.length > 0).length;
  const evidence = questions.filter((question) => question.evidenceOpenedProductId !== null).length;
  const clicked = questions.filter((question) => question.clickedProductId !== null).length;
  const returned = questions.filter((question) => question.returnedWithin14Days).length;
  return {
    questions: questions.length,
    users: new Set(questions.map((question) => question.anonymousUserId)).size,
    informationComplete,
    safetyPassed,
    shown,
    evidence,
    clicked,
    returned,
    completionRate: pct(informationComplete, questions.length),
    exposureRate: pct(shown, questions.length),
    evidenceRate: pct(evidence, shown),
    clickRate: pct(clicked, shown),
    returnRate: pct(returned, questions.length),
    latencyP50: percentile(questions.map((question) => question.context.totalLatencyMs), .5),
    latencyP95: percentile(questions.map((question) => question.context.totalLatencyMs), .95),
  };
}

function deltaLabel(current: number, previous: number, point = false) {
  const delta = current - previous;
  if (point) return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%p`;
  const relative = previous ? (delta / previous) * 100 : 0;
  return `${relative >= 0 ? "+" : ""}${relative.toFixed(1)}%`;
}

function groupLabel(group: GroupId, value: string) {
  if (group === "intentCluster") return VALUE_LABELS.intentClusters[value as keyof typeof VALUE_LABELS.intentClusters] ?? value;
  if (group === "channel") return VALUE_LABELS.channels[value as keyof typeof VALUE_LABELS.channels] ?? value;
  if (group === "device") return VALUE_LABELS.devices[value as keyof typeof VALUE_LABELS.devices] ?? value;
  return VALUE_LABELS.decisions[value as keyof typeof VALUE_LABELS.decisions] ?? value;
}

function groupValue(question: QuestionJourney, group: GroupId) {
  if (group === "decision") return question.decision;
  return question.context[group];
}

function dateBuckets(start: string, end: string, interval: string) {
  const buckets: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    buckets.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + (interval === "week" ? 7 : 1));
  }
  return buckets;
}

function buildSeries(questions: QuestionJourney[], start: string, end: string, group: GroupId, measure: MeasureId, interval: string): LineSeries[] {
  const buckets = dateBuckets(start, end, interval);
  const topGroups = [...new Set(questions.map((question) => groupValue(question, group)))]
    .map((value) => ({ value, count: questions.filter((question) => groupValue(question, group) === value).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  return topGroups.map((item, groupIndex) => ({
    id: item.value,
    label: groupLabel(group, item.value),
    color: COLORS[groupIndex % COLORS.length],
    values: buckets.map((bucket, index) => {
      const next = buckets[index + 1] ?? `${end}z`;
      const inBucket = questions.filter((question) => question.context.questionDate >= bucket && question.context.questionDate < next && groupValue(question, group) === item.value);
      let y = inBucket.length;
      if (measure === "users") y = new Set(inBucket.map((question) => question.anonymousUserId)).size;
      if (measure === "completion_rate") y = computeStats(inBucket).completionRate;
      if (measure === "exposure_rate") y = computeStats(inBucket).exposureRate;
      return { x: bucket, y: Number(y.toFixed(1)) };
    }),
  }));
}

type StageDefinition = { id: string; label: string; event: EventName; test?: (event: AnalyticsEvent) => boolean; description: string };

const FUNNEL_DEFINITIONS: StageDefinition[] = [
  { id: "question", label: "질문 시작", event: "question_started", description: "새 질문 처리 ID가 발급된 질문" },
  { id: "intent", label: "질문 목적 확인", event: "intent_classified", description: "원문 대신 집계 가능한 목적 코드가 생성됨" },
  { id: "information", label: "판단 정보 충족", event: "information_completed", test: (event) => event.properties.informationStatus !== "abandoned", description: "이번 판단에 필요한 필수 정보가 모임" },
  { id: "safety", label: "안전 확인 통과", event: "safety_checked", test: (event) => event.properties.safetyResult === "passed", description: "즉시 상품 흐름을 멈출 신호가 없음" },
  { id: "candidate", label: "관련 상품 발견", event: "candidates_searched", description: "질문 목적과 맞는 상품군에서 후보를 찾음" },
  { id: "eligible", label: "적격 상품 있음", event: "candidate_evaluated", test: (event) => event.properties.candidateStatus === "eligible", description: "적어도 한 상품이 모든 필수 조건을 통과" },
  { id: "shown", label: "적격 상품 노출", event: "recommendation_shown", description: "상품이 사용자 화면에 실제로 표시됨" },
  { id: "evidence", label: "선정 근거 열람", event: "evidence_opened", description: "사용자가 왜 선정됐는지 펼쳐 봄" },
  { id: "click", label: "상품 상세 이동", event: "product_clicked", description: "사용자가 상품의 상세 정보로 이동" },
];

function buildOrderedFunnel(questions: QuestionJourney[], order: "this" | "exact" | "any" = "this"): FunnelStage[] {
  const events = questionEvents(questions);
  const byQuestion = new Map<string, AnalyticsEvent[]>();
  for (const event of events) {
    const list = byQuestion.get(event.questionId) ?? [];
    list.push(event);
    byQuestion.set(event.questionId, list);
  }
  const reached: Array<number[]> = FUNNEL_DEFINITIONS.map(() => []);
  for (const rows of byQuestion.values()) {
    rows.sort((a, b) => a.sequence - b.sequence || a.timestamp.localeCompare(b.timestamp));
    if (order === "any") {
      let previousAt: number | null = null;
      for (let stageIndex = 0; stageIndex < FUNNEL_DEFINITIONS.length; stageIndex += 1) {
        const required = FUNNEL_DEFINITIONS.slice(0, stageIndex + 1);
        const matches = required.map((stage) => rows.find((event) => event.name === stage.event && (!stage.test || stage.test(event))));
        if (matches.some((event) => !event)) break;
        const at = Date.parse(matches[stageIndex]!.timestamp);
        reached[stageIndex].push(previousAt === null ? 0 : Math.abs(at - previousAt) / 1000);
        previousAt = at;
      }
      continue;
    }
    let cursor = -1;
    let previousAt: number | null = null;
    let firstAt: number | null = null;
    for (let stageIndex = 0; stageIndex < FUNNEL_DEFINITIONS.length; stageIndex += 1) {
      const stage = FUNNEL_DEFINITIONS[stageIndex];
      let found = -1;
      if (order === "exact") {
        found = rows.findIndex((event, eventIndex) => {
          if (eventIndex <= cursor) return false;
          const isTracked = FUNNEL_DEFINITIONS.some((definition) => event.name === definition.event && (!definition.test || definition.test(event)));
          if (!isTracked) return false;
          return event.name === stage.event && (!stage.test || stage.test(event));
        });
        const firstTrackedAfterCursor = rows.findIndex((event, eventIndex) => eventIndex > cursor && FUNNEL_DEFINITIONS.some((definition) => event.name === definition.event && (!definition.test || definition.test(event))));
        if (firstTrackedAfterCursor !== found) found = -1;
      } else {
        found = rows.findIndex((event, eventIndex) => eventIndex > cursor && event.name === stage.event && (!stage.test || stage.test(event)));
      }
      if (found < 0) break;
      cursor = found;
      const at = Date.parse(rows[found].timestamp);
      firstAt ??= at;
      if (at - firstAt > 30 * 60 * 1000) break;
      reached[stageIndex].push(previousAt === null ? 0 : Math.max(0, (at - previousAt) / 1000));
      previousAt = at;
    }
  }
  return FUNNEL_DEFINITIONS.map((stage, index) => ({ id: stage.id, label: stage.label, count: reached[index].length, medianSeconds: percentile(reached[index], .5), description: stage.description }));
}

function candidateEventsFor(questions: QuestionJourney[]) {
  return questionEvents(questions).filter((event) => event.name === "candidate_evaluated");
}

function productRows(questions: QuestionJourney[]) {
  const events = questionEvents(questions);
  return PRODUCT_CATALOG.map((product) => {
    const candidates = events.filter((event) => event.name === "candidate_evaluated" && event.properties.productId === product.productId);
    const eligible = candidates.filter((event) => event.properties.candidateStatus === "eligible");
    const excluded = candidates.filter((event) => event.properties.candidateStatus === "excluded");
    const review = candidates.filter((event) => event.properties.candidateStatus === "needs_review");
    const shown = events.filter((event) => event.name === "recommendation_shown" && event.properties.productId === product.productId);
    const opened = events.filter((event) => event.name === "evidence_opened" && event.properties.productId === product.productId);
    const clicked = events.filter((event) => event.name === "product_clicked" && event.properties.productId === product.productId);
    const reasonCount = new Map<string, number>();
    for (const event of candidates) for (const code of event.properties.reasonCodes ?? []) if (code !== "REQUIRED_CONDITIONS_PASSED") reasonCount.set(code, (reasonCount.get(code) ?? 0) + 1);
    const topReason = [...reasonCount.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      ...product,
      candidates: candidates.length,
      eligible: eligible.length,
      excluded: excluded.length,
      review: review.length,
      shown: new Set(shown.map((event) => event.questionId)).size,
      opened: new Set(opened.map((event) => event.questionId)).size,
      clicked: new Set(clicked.map((event) => event.questionId)).size,
      eligibleRate: pct(eligible.length, candidates.length),
      showRate: pct(new Set(shown.map((event) => event.questionId)).size, new Set(eligible.map((event) => event.questionId)).size),
      clickRate: pct(new Set(clicked.map((event) => event.questionId)).size, new Set(shown.map((event) => event.questionId)).size),
      topReason: topReason?.[0] ?? "모든 필수 조건 통과",
      topReasonCount: topReason?.[1] ?? 0,
      averageScore: eligible.length ? eligible.reduce((sum, event) => sum + (event.properties.productScore ?? 0), 0) / eligible.length : 0,
    };
  }).sort((a, b) => b.candidates - a.candidates);
}

function buildJourney(questions: QuestionJourney[]): { nodes: JourneyNode[]; links: JourneyLink[] } {
  const root = questions.length;
  const byIntent = [...new Set(questions.map((question) => question.context.intentCluster))]
    .map((intent) => ({ intent, rows: questions.filter((question) => question.context.intentCluster === intent) }))
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, 4);
  const nodes: JourneyNode[] = [{ id: "start", label: "질문 시작", column: 0, order: 0, count: root }];
  const links: JourneyLink[] = [];
  byIntent.forEach((group, index) => {
    const id = `intent-${group.intent}`;
    nodes.push({ id, label: groupLabel("intentCluster", group.intent), column: 1, order: index, count: group.rows.length });
    links.push({ source: "start", target: id, count: group.rows.length });
  });
  const moreCount = questions.length - byIntent.reduce((sum, group) => sum + group.rows.length, 0);
  if (moreCount > 0) {
    nodes.push({ id: "intent-other", label: "그 밖의 질문 목적", column: 1, order: 4, count: moreCount });
    links.push({ source: "start", target: "intent-other", count: moreCount });
  }
  const outcomes = [
    { id: "info-complete", label: "필요 정보 확인 완료", test: (q: QuestionJourney) => !q.reasonCodes.includes("REQUIRED_INFORMATION_INCOMPLETE"), tone: "safe" as const },
    { id: "info-missing", label: "추가 정보에서 이탈", test: (q: QuestionJourney) => q.reasonCodes.includes("REQUIRED_INFORMATION_INCOMPLETE"), tone: "default" as const },
    { id: "safety-stop", label: "안전 안내로 전환", test: (q: QuestionJourney) => q.safetyResult === "stopped", tone: "stop" as const },
  ];
  outcomes.forEach((outcome, index) => {
    const count = questions.filter(outcome.test).length;
    nodes.push({ id: outcome.id, label: outcome.label, column: 2, order: index, count, tone: outcome.tone });
  });
  const allIntentNodes = [...byIntent.map((group) => ({ id: `intent-${group.intent}`, rows: group.rows })), ...(moreCount > 0 ? [{ id: "intent-other", rows: questions.filter((q) => !byIntent.some((g) => g.intent === q.context.intentCluster)) }] : [])];
  for (const item of allIntentNodes) for (const outcome of outcomes) {
    const count = item.rows.filter(outcome.test).length;
    if (count > 0) links.push({ source: item.id, target: outcome.id, count });
  }
  const decisions = [
    { id: "product", label: "적격 상품 제안", test: (q: QuestionJourney) => q.decision === "show_products", tone: "action" as const },
    { id: "food", label: "음식 우선 안내", test: (q: QuestionJourney) => q.decision === "food_first", tone: "safe" as const },
    { id: "hold", label: "기록·정보 더 확인", test: (q: QuestionJourney) => q.decision === "need_more_information", tone: "default" as const },
    { id: "consult", label: "전문가 확인 권장", test: (q: QuestionJourney) => q.decision === "consult_professional" || q.decision === "safety_stop", tone: "stop" as const },
  ];
  decisions.forEach((decision, index) => nodes.push({ id: decision.id, label: decision.label, column: 3, order: index, count: questions.filter(decision.test).length, tone: decision.tone }));
  for (const outcome of outcomes) for (const decision of decisions) {
    const count = questions.filter((q) => outcome.test(q) && decision.test(q)).length;
    if (count > 0) links.push({ source: outcome.id, target: decision.id, count });
  }
  const actions = [
    { id: "evidence", label: "추천 근거 열람", test: (q: QuestionJourney) => Boolean(q.evidenceOpenedProductId), tone: "action" as const },
    { id: "click", label: "상품 상세 이동", test: (q: QuestionJourney) => Boolean(q.clickedProductId), tone: "action" as const },
    { id: "no-action", label: "추가 행동 없음", test: (q: QuestionJourney) => q.decision === "show_products" && !q.evidenceOpenedProductId, tone: "default" as const },
  ];
  actions.forEach((action, index) => nodes.push({ id: action.id, label: action.label, column: 4, order: index, count: questions.filter(action.test).length, tone: action.tone }));
  for (const decision of decisions) for (const action of actions) {
    const count = questions.filter((q) => decision.test(q) && action.test(q)).length;
    if (count > 0) links.push({ source: decision.id, target: action.id, count });
  }
  return { nodes, links };
}

function groupRows(questions: QuestionJourney[], group: GroupId) {
  const values = [...new Set(questions.map((question) => groupValue(question, group)))];
  return values.map((value) => {
    const rows = questions.filter((question) => groupValue(question, group) === value);
    const stats = computeStats(rows);
    return { value, label: groupLabel(group, value), ...stats };
  }).sort((a, b) => b.questions - a.questions);
}

function safeJson(event: AnalyticsEvent) {
  return JSON.stringify({
    event_name: event.name,
    occurred_at: event.timestamp,
    sequence: event.sequence,
    question_id: event.questionId,
    engine_version: event.context.engineVersion,
    parser_version: event.context.parserVersion,
    product_id: event.properties.productId,
    decision: event.properties.decision,
    reason_codes: event.properties.reasonCodes,
  }, null, 2);
}

function Toolbar({ date, onDate, segment, onSegment, interval, onInterval, openMenu, setOpenMenu, onOpenFilters, filterCount }: {
  date: DateRangeValue; onDate: (value: DateRangeValue) => void; segment: SegmentId; onSegment: (value: SegmentId) => void; interval: string; onInterval: (value: string) => void; openMenu: string | null; setOpenMenu: (value: string | null) => void; onOpenFilters: () => void; filterCount: number;
}) {
  return <div className="analysis-toolbar">
    <div className="toolbar-left">
      <DateRangeControl value={date} onChange={onDate} openMenu={openMenu} setOpenMenu={setOpenMenu} />
      <ChoiceMenu id="interval" value={interval} options={INTERVAL_OPTIONS} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={onInterval} />
      <ChoiceMenu id="segment" icon="users" value={segment} options={SEGMENT_OPTIONS} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={(value) => onSegment(value as SegmentId)} />
      <button className={`control-button ${filterCount ? "active" : ""}`} onClick={onOpenFilters}><Icon name="filter" size={16} /><span>{filterCount ? `조건 ${filterCount}개` : "조건 추가"}</span><Icon name="plus" size={14} /></button>
    </div>
    <div className="toolbar-right"><span>{formatCount(filterQuestions(date.start, date.end, segment).length)}개 질문</span><span className="toolbar-divider" />선택 기간 전체 계산<button className="icon-button" title="다시 계산" aria-label="결과 다시 계산"><span className="refresh-icon">↻</span></button></div>
  </div>;
}

function QuerySection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <section className="query-section"><div className="query-section-title"><span>{number}</span><b>{title}</b></div>{children}</section>;
}

function ResultHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="result-header"><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{actions && <div className="result-actions">{actions}</div>}</div>;
}

function InsightCard({ tone, title, body, evidence, action, onAction }: { tone: "blue" | "amber" | "green"; title: string; body: string; evidence: string; action: string; onAction?: () => void }) {
  return <article className={`insight-card ${tone}`}><div className="insight-status" aria-hidden="true" /><div><h3>{title}</h3><p>{body}</p><small>{evidence}</small><button onClick={onAction}>{action}<Icon name="arrow" size={14} /></button></div></article>;
}

function Overview({ questions, previous, interval, onNavigate, onToast }: { questions: QuestionJourney[]; previous: QuestionJourney[]; interval: string; onNavigate: (view: ViewId) => void; onToast: (text: string) => void }) {
  const stats = computeStats(questions);
  const prev = computeStats(previous);
  const series = buildSeries(questions, questions[0]?.context.questionDate ?? DATASET_WINDOW.start, questions.at(-1)?.context.questionDate ?? DATASET_WINDOW.end, "intentCluster", "questions", interval);
  const funnel = buildOrderedFunnel(questions).slice(0, 7);
  const productData = productRows(questions);
  const shortBase = questions.filter((q) => q.context.baselineDays < 28 && q.decision === "need_more_information");
  const prevShort = previous.filter((q) => q.context.baselineDays < 28 && q.decision === "need_more_information");
  const staleGap = candidateEventsFor(questions).filter((event) => event.properties.reasonCodes?.includes("LABEL_REVIEW_DUE")).length;
  return <div className="view-stack">
    <div className="dataset-note"><span>DEMO DATA</span><p>{SYNTHETIC_DATA_NOTICE}</p><button onClick={() => onNavigate("data")}>정의 보기</button></div>
    <section className="summary-panel" aria-label="핵심 지표">
      <div><span>질문</span><strong>{formatCount(stats.questions)}</strong><small>{deltaLabel(stats.questions, prev.questions)} · 이전 {formatCount(prev.questions)}</small></div>
      <div><span>정보 확인 완료</span><strong>{formatPercent(stats.completionRate)}</strong><small>{deltaLabel(stats.completionRate, prev.completionRate, true)} · {formatCount(stats.informationComplete)}건</small></div>
      <div><span>상품 노출</span><strong>{formatPercent(stats.exposureRate)}</strong><small>{deltaLabel(stats.exposureRate, prev.exposureRate, true)} · {formatCount(stats.shown)}건</small></div>
      <div><span>상세 이동</span><strong>{formatPercent(stats.clickRate)}</strong><small>{deltaLabel(stats.clickRate, prev.clickRate, true)} · 노출 질문 기준</small></div>
    </section>

    <div className="overview-main-grid">
      <section className="panel trend-panel">
        <ResultHeader eyebrow="질문 추세" title="질문 목적별 고유 질문 수" description="일별 · 상위 5개 질문 목적 · 이전 같은 기간 비교" actions={<button className="text-button" onClick={() => onNavigate("questions")}>분석 열기 <Icon name="arrow" size={14} /></button>} />
        <TimeSeriesChart series={series.slice(0, 5)} height={300} />
      </section>
      <section className="insight-column">
        <div className="column-heading"><div><span>선택 기간에 감지됨</span><b>확인할 변화</b></div><button onClick={() => onNavigate("insights")}>인사이트 열기</button></div>
        <InsightCard tone="amber" title={`짧은 기준 기록으로 보류된 질문이 ${formatCount(shortBase.length)}건입니다.`} body={`${formatPercent(pct(shortBase.length, questions.length))}가 같은 기기 기록 28일 미만과 함께 나타났습니다. 이전 기간 ${formatCount(prevShort.length)}건과 비교해 원인을 더 나눠 봐야 합니다.`} evidence={`n=${formatCount(questions.length)} · 엔진/파서 버전도 함께 바뀌어 인과 단정 불가`} action="이 질문군 보기" onAction={() => onNavigate("sessions")} />
        <InsightCard tone="blue" title={`라벨 확인 시점 때문에 ${formatCount(staleGap)}회 상품 평가가 막혔습니다.`} body="상품 정보를 갱신하면 다시 평가할 수 있지만, 노출이나 클릭 증가를 보장하지는 않습니다." evidence="상품별 candidate_evaluated 이벤트의 결정 이유 집계" action="상품별 원인 보기" onAction={() => onNavigate("products")} />
        <button className="create-monitor" onClick={() => onToast("주간 모니터로 저장했습니다.")}><Icon name="plus" size={16} />주간 모니터에 추가</button>
      </section>
    </div>

    <section className="panel funnel-summary-panel">
      <ResultHeader eyebrow="전환" title="질문에서 적격 상품 노출까지" description="같은 질문 ID에서 30분 안에 순서대로 발생한 이벤트" actions={<button className="text-button" onClick={() => onNavigate("funnel")}>전환 분석 열기 <Icon name="arrow" size={14} /></button>} />
      <div className="mini-funnel-row">{funnel.map((stage, index) => <div key={stage.id} className="mini-funnel-step"><span>{stage.label}</span><b>{formatCount(stage.count)}</b>{index > 0 && <small>{formatPercent(pct(stage.count, funnel[index - 1].count))} 전환</small>}<em>{formatPercent(pct(stage.count, funnel[0].count))}</em></div>)}</div>
    </section>

    <section className="panel compact-table-panel">
      <ResultHeader eyebrow="상품" title="상품별 적격 평가와 행동" description="후보 평가 → 적격 → 실제 노출 → 상세 이동" />
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>상품</th><th>검토 대상</th><th>적격률</th><th>실제 노출</th><th>상세 이동률</th><th>가장 많은 확인 필요 이유</th></tr></thead><tbody>{productData.slice(0, 5).map((row) => <tr key={row.productId}><td><b>{row.name}</b><small>{row.productId} · {row.format}</small></td><td className="num">{formatCount(row.candidates)}</td><td className="num"><span className="cell-bar"><i style={{ width: `${row.eligibleRate}%` }} />{formatPercent(row.eligibleRate)}</span></td><td className="num">{formatCount(row.shown)}</td><td className="num">{formatPercent(row.clickRate)}</td><td>{REASON_LABELS[row.topReason] ?? row.topReason}{row.topReasonCount > 0 && <small>{formatCount(row.topReasonCount)}회</small>}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function QuestionsView({ questions, date, interval, group, setGroup, measure, setMeasure, openMenu, setOpenMenu, onToast }: { questions: QuestionJourney[]; date: DateRangeValue; interval: string; group: GroupId; setGroup: (value: GroupId) => void; measure: MeasureId; setMeasure: (value: MeasureId) => void; openMenu: string | null; setOpenMenu: (value: string | null) => void; onToast: (text: string) => void }) {
  const series = buildSeries(questions, date.start, date.end, group, measure, interval);
  const rows = groupRows(questions, group);
  const measureLabel = MEASURE_OPTIONS.find((item) => item.value === measure)?.label ?? "고유 질문 수";
  return <div className="analysis-workspace">
    <aside className="query-builder">
      <div className="builder-head"><div><span>분석 정의</span><b>질문 분석</b></div><button className="icon-button" aria-label="분석 설정"><Icon name="more" size={17} /></button></div>
      <QuerySection number="1" title="이벤트">
        <div className="event-row"><span className="event-letter violet">A</span><div><b>질문 시작</b><small>question_started · 공식 이벤트</small><div><button>+ 조건 추가</button><button>+ 기준별 나누기</button></div></div><button className="icon-button"><Icon name="more" size={15} /></button></div>
        <button className="builder-add"><Icon name="plus" size={14} /> 행동 또는 지표 추가</button>
      </QuerySection>
      <QuerySection number="2" title="측정">
        <ChoiceMenu id="question-measure" value={measure} options={MEASURE_OPTIONS} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={(value) => setMeasure(value as MeasureId)} />
      </QuerySection>
      <QuerySection number="3" title="사용자 그룹">
        <div className="segment-row"><span className="segment-letter blue">1</span><div><b>모든 질문</b><small>선택 기간에 시작된 질문</small><div><button>+ 조건 추가</button><button>+ 저장 그룹</button><button>+ 행동 조건</button></div></div></div>
        <button className="builder-add"><Icon name="plus" size={14} /> 비교할 그룹 추가</button>
      </QuerySection>
      <QuerySection number="4" title="나누기">
        <ChoiceMenu id="question-group" value={group} options={GROUP_OPTIONS} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={(value) => setGroup(value as GroupId)} />
      </QuerySection>
      <div className="builder-footer"><button className="secondary-button">초기화</button><button className="primary-button">계산</button></div>
    </aside>
    <section className="result-canvas">
      <ResultHeader eyebrow="질문 시작" title={`${measureLabel} · ${GROUP_OPTIONS.find((item) => item.value === group)?.label}`} description={`${date.start.replaceAll("-", ".")}–${date.end.replaceAll("-", ".")} · ${interval === "day" ? "일별" : "주별"} · 전체 데이터`} actions={<><button className="secondary-button" onClick={() => onToast("분석을 저장했습니다.")}><Icon name="save" size={15} />저장</button><button className="icon-button" aria-label="결과 메뉴"><Icon name="more" size={17} /></button></>} />
      <div className="chart-toolbar"><div className="chart-tabs"><button className="active">선</button><button>막대</button><button>누적</button><button>표</button></div><span>{formatCount(questions.length)}개 질문 · {series.length}개 항목</span></div>
      <TimeSeriesChart series={series} height={360} />
      <div className="breakdown-head"><div><b>세부 결과</b><span>상위 {rows.length}개 값을 모두 계산했습니다.</span></div><button className="secondary-button"><Icon name="download" size={14} /> CSV</button></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>{GROUP_OPTIONS.find((item) => item.value === group)?.label}</th><th>질문 수</th><th>필요 정보 완료율</th><th>안전 확인 통과</th><th>적격 상품 노출률</th><th>근거 열람률</th><th>상세 이동률</th></tr></thead><tbody>{rows.map((row) => <tr key={row.value}><td><span className="legend-label"><i style={{ background: COLORS[rows.indexOf(row) % COLORS.length] }} />{row.label}</span></td><td className="num"><b>{formatCount(row.questions)}</b><small>{formatPercent(pct(row.questions, questions.length))}</small></td><td className="num">{formatPercent(row.completionRate)}</td><td className="num">{formatCount(row.safetyPassed)}</td><td className="num"><span className="cell-bar"><i style={{ width: `${row.exposureRate}%` }} />{formatPercent(row.exposureRate)}</span></td><td className="num">{formatPercent(row.evidenceRate)}</td><td className="num">{formatPercent(row.clickRate)}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function FunnelView({ questions, selectedStage, setSelectedStage, order, setOrder, openMenu, setOpenMenu, onSaveCohort }: { questions: QuestionJourney[]; selectedStage: string; setSelectedStage: (value: string) => void; order: string; setOrder: (value: string) => void; openMenu: string | null; setOpenMenu: (value: string | null) => void; onSaveCohort: (name: string, size: number) => void }) {
  const funnel = buildOrderedFunnel(questions, order as "this" | "exact" | "any");
  const selected = funnel.find((stage) => stage.id === selectedStage) ?? funnel[0];
  const selectedIndex = funnel.findIndex((stage) => stage.id === selected.id);
  const previous = funnel[Math.max(0, selectedIndex - 1)];
  const orderOptions: MenuOption[] = [
    { value: "this", label: "이 순서로", description: "중간 행동은 허용하되 지정한 단계 순서를 지킵니다." },
    { value: "exact", label: "정확히 이 순서로", description: "지정하지 않은 중간 행동이 있으면 제외합니다." },
    { value: "any", label: "어떤 순서든", description: "모든 단계를 수행했는지만 봅니다." },
  ];
  return <div className="analysis-workspace funnel-workspace">
    <aside className="query-builder">
      <div className="builder-head"><div><span>분석 정의</span><b>전환</b></div><button className="icon-button" aria-label="전환 설정"><Icon name="more" size={17} /></button></div>
      <QuerySection number="1" title="단계">
        <div className="funnel-step-list">{FUNNEL_DEFINITIONS.slice(0, 7).map((stage, index) => <div key={stage.id} className="funnel-builder-step"><span>{index + 1}</span><div><b>{stage.label}</b><small>{stage.event}</small></div><button className="icon-button"><Icon name="more" size={14} /></button></div>)}</div>
        <button className="builder-add"><Icon name="plus" size={14} /> 단계 추가</button>
      </QuerySection>
      <QuerySection number="2" title="전환 규칙">
        <ChoiceMenu id="funnel-order" value={order} options={orderOptions} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={setOrder} />
        <div className="builder-setting"><span>같은 질문 안에서</span><b>30분 안에 완료</b></div>
        <button className="builder-add muted"><Icon name="plus" size={14} /> 중간에 제외할 행동</button>
      </QuerySection>
      <QuerySection number="3" title="사용자 그룹">
        <div className="segment-row"><span className="segment-letter blue">1</span><div><b>모든 질문</b><small>{formatCount(questions.length)}건</small></div></div>
        <button className="builder-add"><Icon name="plus" size={14} /> 비교할 고객 그룹 추가</button>
      </QuerySection>
    </aside>
    <section className="result-canvas">
      <ResultHeader eyebrow="같은 질문 ID · 30분" title="질문 시작 → 적격 상품 노출" description={`각 폭은 첫 단계 대비 잔존 비율입니다. ${orderOptions.find((item) => item.value === order)?.label} 조건.`} actions={<div className="chart-tabs"><button className="active">전환</button><button>시간 추세</button><button>전환 시간</button></div>} />
      <div className="funnel-kpis"><div><span>상품 노출까지 전체 전환</span><strong>{formatPercent(pct(funnel[6]?.count ?? 0, funnel[0]?.count ?? 0))}</strong></div><div><span>가장 큰 이탈</span><strong>{funnel.reduce((best, stage, index) => index === 0 ? best : (funnel[index - 1].count - stage.count > best.drop ? { label: `${funnel[index - 1].label} → ${stage.label}`, drop: funnel[index - 1].count - stage.count } : best), { label: "-", drop: 0 }).label}</strong></div><div><span>상품 노출까지 중앙 시간</span><strong>{Math.round(funnel.slice(1, 7).reduce((sum, stage) => sum + (stage.medianSeconds ?? 0), 0))}초</strong></div></div>
      <CurvedFunnel stages={funnel} selected={selected.id} onSelect={setSelectedStage} />
      <div className="stage-inspector">
        <div><span>선택한 단계 · {selectedIndex + 1}/{funnel.length}</span><h3>{selected.label}</h3><p>{selected.description}</p></div>
        <div className="inspector-metrics"><p><span>이 단계 도달</span><b>{formatCount(selected.count)}건</b></p><p><span>이전 단계 대비</span><b>{formatPercent(pct(selected.count, previous.count))}</b></p><p><span>첫 질문 대비</span><b>{formatPercent(pct(selected.count, funnel[0].count))}</b></p><p><span>이전 단계에서 중앙 시간</span><b>{selected.medianSeconds ? `${Math.round(selected.medianSeconds)}초` : "시작"}</b></p></div>
        <div className="inspector-actions"><button onClick={() => onSaveCohort(`${selected.label} 도달 질문군`, selected.count)}><Icon name="users" size={15} /> 고객 그룹으로 저장</button><button><Icon name="list" size={15} /> 질문 처리 기록 보기</button></div>
      </div>
    </section>
  </div>;
}

function JourneysView({ questions, selectedNode, setSelectedNode, openMenu, setOpenMenu, onSaveCohort }: { questions: QuestionJourney[]; selectedNode: string; setSelectedNode: (value: string) => void; openMenu: string | null; setOpenMenu: (value: string | null) => void; onSaveCohort: (name: string, size: number) => void }) {
  const [depth, setDepth] = useState("5");
  const [collapseRepeats, setCollapseRepeats] = useState(true);
  const [groupRare, setGroupRare] = useState(true);
  const fullJourney = buildJourney(questions);
  const maxColumn = Number(depth) - 1;
  const visibleNodeIds = new Set(fullJourney.nodes.filter((item) => item.column <= maxColumn).map((item) => item.id));
  const journey = {
    nodes: fullJourney.nodes.filter((item) => visibleNodeIds.has(item.id)),
    links: fullJourney.links.filter((item) => visibleNodeIds.has(item.source) && visibleNodeIds.has(item.target)),
  };
  const node = journey.nodes.find((item) => item.id === selectedNode) ?? journey.nodes[0];
  const inbound = journey.links.filter((link) => link.target === node.id).sort((a, b) => b.count - a.count);
  const outbound = journey.links.filter((link) => link.source === node.id).sort((a, b) => b.count - a.count);
  const nodeName = (id: string) => journey.nodes.find((item) => item.id === id)?.label ?? id;
  return <div className="analysis-workspace journey-workspace">
    <aside className="query-builder">
      <div className="builder-head"><div><span>경로 찾기</span><b>사용자 여정</b></div><button className="icon-button"><Icon name="more" size={17} /></button></div>
      <QuerySection number="1" title="어디에서 시작할까요?">
        <div className="selected-event"><span className="event-letter violet">S</span><div><b>질문 시작</b><small>question_started</small></div></div>
        <div className="direction-tabs"><button className="active">이후 행동 보기</button><button>이전 행동 보기</button></div>
      </QuerySection>
      <QuerySection number="2" title="어디까지 볼까요?">
        <ChoiceMenu id="journey-depth" value={depth} options={[{ value: "3", label: "최대 3단계" }, { value: "4", label: "최대 4단계" }, { value: "5", label: "최대 5단계" }]} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={setDepth} />
        <div className="builder-setting"><span>경로 범위</span><b>같은 질문 안에서</b></div>
        <button className="toggle-setting" onClick={() => setCollapseRepeats((value) => !value)} aria-pressed={collapseRepeats}><span><b>반복 행동 접기</b><small>연속된 같은 행동을 한 단계로 표시</small></span><i className={collapseRepeats ? "on" : ""} /></button>
        <button className="toggle-setting" onClick={() => setGroupRare((value) => !value)} aria-pressed={groupRare}><span><b>1% 미만을 ‘기타’로 묶기</b><small>드문 경로를 숨기지 않고 묶어서 표시</small></span><i className={groupRare ? "on" : ""} /></button>
      </QuerySection>
      <QuerySection number="3" title="누구의 경로를 볼까요?">
        <div className="segment-row"><span className="segment-letter blue">1</span><div><b>모든 질문</b><small>{formatCount(questions.length)}건의 첫 경로</small></div></div>
        <button className="builder-add"><Icon name="plus" size={14} /> 저장된 고객 그룹 사용</button>
      </QuerySection>
    </aside>
    <section className="result-canvas journey-canvas">
      <ResultHeader eyebrow="실제 행동 순서 · 경로 지도" title="질문 뒤 사용자는 실제로 어떤 길을 갔나요?" description={`리본이 두꺼울수록 더 많은 질문이 이동했습니다. 현재 ${depth}단계까지 표시하며 안전 안내는 보호 결과로 구분합니다.`} actions={<div className="chart-tabs"><button className="active">경로 지도</button><button>상위 경로</button><button>집단 비교</button></div>} />
      <div className="journey-toolbar"><span><i className="journey-legend violet" />질문 목적</span><span><i className="journey-legend green" />정상 진행</span><span><i className="journey-legend red" />보호 전환</span><span><i className="journey-legend blue" />상품 행동</span><small>고유 질문 기준 · 첫 번째 경로</small></div>
      <JourneySankey nodes={journey.nodes} links={journey.links} selected={selectedNode || undefined} onSelect={setSelectedNode} />
      <div className="journey-inspector">
        <div className="inspector-title"><span>선택한 경로 지점</span><h3>{node.label}</h3><p>{formatCount(node.count)}건 · 전체 질문의 {formatPercent(pct(node.count, questions.length))}</p></div>
        <div className="path-columns"><div><b>이전에는 어디에 있었나요?</b>{inbound.length ? inbound.slice(0, 3).map((link) => <p key={link.source}><span>{nodeName(link.source)}</span><em>{formatCount(link.count)}건</em></p>) : <small>시작 지점입니다.</small>}</div><div><b>다음에는 어디로 갔나요?</b>{outbound.length ? outbound.slice(0, 3).map((link) => <p key={link.target}><span>{nodeName(link.target)}</span><em>{formatCount(link.count)}건</em></p>) : <small>이 경로의 마지막 지점입니다.</small>}</div></div>
        <div className="inspector-actions"><button onClick={() => onSaveCohort(`${node.label} 경로`, node.count)}><Icon name="users" size={15} /> 이 경로를 고객 그룹으로 저장</button><button><Icon name="funnel" size={15} /> 퍼널로 열기</button><button><Icon name="list" size={15} /> 처리 기록 보기</button></div>
      </div>
    </section>
  </div>;
}

function CohortsView({ cohorts, setCohorts, questions, openMenu, setOpenMenu, onToast }: { cohorts: SavedCohort[]; setCohorts: (value: SavedCohort[]) => void; questions: QuestionJourney[]; openMenu: string | null; setOpenMenu: (value: string | null) => void; onToast: (text: string) => void }) {
  const [rules, setRules] = useState<CohortRule[]>([
    { id: "r1", field: "intent", operator: "is", value: "reduced_intake_support" },
    { id: "r2", field: "event", operator: "performed", value: "recommendation_shown" },
  ]);
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [selected, setSelected] = useState<string[]>(["C-01", "C-02"]);
  const estimate = questions.filter((question) => rules[0]?.value === question.context.intentCluster && (rules.length < 2 || question.exposedProductIds.length > 0)).length;
  const fieldOptions: MenuOption[] = [
    { value: "intent", label: "구체적인 질문 목적", description: "파싱된 질문 목적 코드" },
    { value: "baseline", label: "비교에 쓴 기준 기록 일수" },
    { value: "device", label: "기기 종류" },
    { value: "decision", label: "사용자에게 보여준 안내" },
    { value: "event", label: "수행한 행동" },
  ];
  const save = () => {
    const created: SavedCohort = { id: `C-${String(cohorts.length + 1).padStart(2, "0")}`, name: "식사량 감소 후 상품을 본 사용자", description: "질문 목적 = 식사량 감소 AND 상품 제안 노출 수행", size: estimate, change: 0, type: "동적", owner: "나", updated: "방금", privacyReady: estimate >= 30 };
    setCohorts([created, ...cohorts]);
    onToast(`고객 그룹 “${created.name}”을 저장했습니다.`);
  };
  const cohortSeries = selected.slice(0, 2).map((id, index) => {
    const cohort = cohorts.find((item) => item.id === id)!;
    return { id, label: cohort.name, color: COLORS[index], values: dateBuckets("2026-09-04", "2026-10-03", "day").map((x, day) => ({ x, y: Math.round(cohort.size * (.82 + day / 120 + Math.sin(day * .52 + index) * .035)) })) };
  });
  return <div className="cohort-page view-stack">
    <section className="panel cohort-builder-panel">
      <div className="cohort-builder-head"><div><span>새 고객 그룹</span><h2>어떤 사용자를 한 그룹으로 묶을까요?</h2><p>조건은 매일 다시 계산되는 동적 그룹으로 저장됩니다.</p></div><div className="estimate"><span>현재 조건 예상</span><strong>{formatCount(estimate)}명</strong><small>{estimate >= 30 ? "집계 최소 인원 충족" : "최소 인원 미달"}</small></div></div>
      <div className="rule-builder">
        <div className="rule-intro">다음 조건을 <div className="mini-segmented"><button className={logic === "AND" ? "active" : ""} onClick={() => setLogic("AND")}>모두 만족</button><button className={logic === "OR" ? "active" : ""} onClick={() => setLogic("OR")}>하나 이상 만족</button></div></div>
        {rules.map((rule, index) => <div className="rule-row" key={rule.id}><span className="rule-join">{index === 0 ? "포함" : logic}</span><ChoiceMenu id={`rule-field-${rule.id}`} value={rule.field} options={fieldOptions} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={(value) => setRules(rules.map((item) => item.id === rule.id ? { ...item, field: value as CohortRule["field"] } : item))} /><span className="rule-operator">{rule.operator === "performed" ? "수행함" : "같음"}</span><button className="rule-value">{rule.field === "intent" ? "식사량이 줄어 보완이 필요함" : rule.field === "event" ? "적격 상품 노출" : rule.value}<Icon name="chevron" size={14} /></button><span className="rule-window">최근 30일</span><button className="icon-button" aria-label="조건 삭제" onClick={() => setRules(rules.filter((item) => item.id !== rule.id))}><Icon name="close" size={15} /></button></div>)}
        <button className="add-rule" onClick={() => setRules([...rules, { id: `r${Date.now()}`, field: "device", operator: "is", value: "mobile" }])}><Icon name="plus" size={14} /> 조건 추가</button>
        <div className="cohort-builder-footer"><button className="secondary-button">예상 인원 다시 계산</button><button className="primary-button" onClick={save}><Icon name="save" size={15} /> 고객 그룹 저장</button></div>
      </div>
    </section>
    <section className="panel cohort-list-panel">
      <ResultHeader eyebrow="저장된 고객 그룹" title="그룹을 비교하거나 다른 분석에 사용하세요" description="동적 그룹은 조건을 현재 만족하는 익명 사용자를 자동으로 다시 계산합니다." actions={<button className="secondary-button"><Icon name="plus" size={14} /> 새 그룹</button>} />
      <div className="cohort-layout"><div className="cohort-list">{cohorts.map((cohort) => <article key={cohort.id} className={selected.includes(cohort.id) ? "selected" : ""}><button className="cohort-check" onClick={() => setSelected((values) => values.includes(cohort.id) ? values.filter((id) => id !== cohort.id) : values.length < 2 ? [...values, cohort.id] : [values[1], cohort.id])}>{selected.includes(cohort.id) && <Icon name="check" size={13} />}</button><div><div className="cohort-title"><b>{cohort.name}</b><span>{cohort.type}</span>{!cohort.privacyReady && <em>최소 인원 미달</em>}</div><p>{cohort.description}</p><small>{cohort.owner} · {cohort.updated} 계산 · 분석 3개에서 사용</small></div><div className="cohort-size"><b>{formatCount(cohort.size)}</b><span className={cohort.change >= 0 ? "up" : "down"}>{cohort.change >= 0 ? "+" : ""}{cohort.change}%</span></div><button className="icon-button"><Icon name="more" size={16} /></button></article>)}</div><div className="cohort-compare"><div><span>선택한 그룹 비교</span><b>고객 그룹 규모는 어떻게 변했나요?</b></div>{cohortSeries.length ? <TimeSeriesChart series={cohortSeries} height={275} /> : <EmptyState title="비교할 그룹을 선택하세요" body="왼쪽 목록에서 최대 두 그룹을 선택할 수 있습니다." />}<div className="comparison-cards">{selected.slice(0, 2).map((id, index) => { const cohort = cohorts.find((item) => item.id === id)!; return <div key={id}><i style={{ background: COLORS[index] }} /><span>{cohort.name}</span><b>{formatCount(cohort.size)}명</b></div>; })}</div></div></div>
    </section>
  </div>;
}

function ProductsView({ questions, onToast }: { questions: QuestionJourney[]; onToast: (text: string) => void }) {
  const [tab, setTab] = useState<"all" | "fixable" | "safety">("all");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const rows = productRows(questions).filter((row) => tab === "all" || tab === "fixable" ? tab === "all" || row.topReason === "LABEL_REVIEW_DUE" || row.topReason === "INTERACTION_EVIDENCE_MISSING" : row.topReason === "MILK_INGREDIENT_CONFLICT");
  const selected = productRows(questions).find((row) => row.productId === selectedProduct);
  return <div className="view-stack products-page">
    <div className="metric-grid four">
      <MetricCard label="상품이 검토된 횟수" value={formatCount(candidateEventsFor(questions).length)} help="질문×상품 단위 candidate_evaluated 이벤트 수입니다." />
      <MetricCard label="필수 조건 통과율" value={formatPercent(pct(candidateEventsFor(questions).filter((event) => event.properties.candidateStatus === "eligible").length, candidateEventsFor(questions).length))} help="모든 후보 평가 중 적격으로 판정된 비율입니다." />
      <MetricCard label="상품 정보 보완 시 재평가 가능" value={formatCount(candidateEventsFor(questions).filter((event) => event.properties.reasonCodes?.some((code) => code === "LABEL_REVIEW_DUE" || code === "INTERACTION_EVIDENCE_MISSING")).length)} help="라벨 최신성 또는 상호작용 자료 문제로 제외·검토된 질문×상품 수입니다." tone="warn" />
      <MetricCard label="적격 상품 상세 이동률" value={formatPercent(computeStats(questions).clickRate)} help="상품이 실제 노출된 질문 중 상세로 이동한 비율입니다." />
    </div>
    <section className="panel product-table-panel">
      <ResultHeader eyebrow="질문×상품 평가 원장" title="어느 상품이 왜 노출되거나 제외됐나요?" description="후보 수나 노출 수를 비율로 추정하지 않고 실제 상품 평가·노출·클릭 이벤트에서 계산했습니다." actions={<button className="secondary-button" onClick={() => onToast("상품 성과 CSV를 준비했습니다.")}><Icon name="download" size={14} /> CSV</button>} />
      <div className="table-filter-row"><div className="chart-tabs"><button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>전체 상품</button><button className={tab === "fixable" ? "active" : ""} onClick={() => setTab("fixable")}>상품 정보 보완 가능</button><button className={tab === "safety" ? "active" : ""} onClick={() => setTab("safety")}>사용자 조건으로 제외</button></div><span>상품 8개 · 질문×상품 {formatCount(candidateEventsFor(questions).length)}건</span></div>
      <div className="data-table-wrap"><table className="data-table product-table"><thead><tr><th>상품</th><th>검토 대상</th><th>적격</th><th>제외</th><th>추가 확인</th><th>적격률</th><th>평균 점수</th><th>실제 노출</th><th>근거 열람</th><th>상세 이동률</th><th>가장 많은 이유</th></tr></thead><tbody>{rows.map((row) => <tr key={row.productId} onClick={() => setSelectedProduct(row.productId)}><td><b>{row.name}</b><small>{row.productId} · {PRODUCT_CATEGORY_LABELS[row.category] ?? row.category}</small></td><td className="num">{formatCount(row.candidates)}</td><td className="num good-text">{formatCount(row.eligible)}</td><td className="num danger-text">{formatCount(row.excluded)}</td><td className="num warn-text">{formatCount(row.review)}</td><td className="num"><span className="cell-bar"><i style={{ width: `${row.eligibleRate}%` }} />{formatPercent(row.eligibleRate)}</span></td><td className="num">{row.averageScore ? row.averageScore.toFixed(1) : "—"}</td><td className="num">{formatCount(row.shown)}</td><td className="num">{formatCount(row.opened)}</td><td className="num">{formatPercent(row.clickRate)}</td><td><span className={`reason-tag ${row.topReason === "MILK_INGREDIENT_CONFLICT" ? "personal" : "fixable"}`}>{REASON_LABELS[row.topReason] ?? row.topReason}</span><small>{row.topReasonCount ? `${formatCount(row.topReasonCount)}회` : ""}</small></td></tr>)}</tbody></table></div>
    </section>
    {selected && <div className="side-drawer-backdrop" onClick={() => setSelectedProduct(null)}><aside className="side-drawer product-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><span>{selected.productId}</span><h2>{selected.name}</h2><p>합성 상품 · 실제 판매 상품 아님</p></div><button className="icon-button" onClick={() => setSelectedProduct(null)}><Icon name="close" size={18} /></button></div><div className="drawer-score"><div><span>적격 평가 평균 점수</span><strong>{selected.averageScore.toFixed(1)}</strong><small>/100</small></div><p>필수 조건을 통과한 평가에서만 계산합니다. 제외된 상품에는 점수를 매기지 않습니다.</p></div><div className="drawer-section"><h3>선택 기간 성과</h3><div className="drawer-metric-grid"><p><span>검토 대상</span><b>{formatCount(selected.candidates)}</b></p><p><span>적격</span><b>{formatCount(selected.eligible)}</b></p><p><span>실제 노출</span><b>{formatCount(selected.shown)}</b></p><p><span>상세 이동</span><b>{formatCount(selected.clicked)}</b></p></div></div><div className="drawer-section"><h3>브랜드가 확인할 정보</h3><p className="drawer-reason"><span className="warn-dot" /><b>{REASON_LABELS[selected.topReason] ?? selected.topReason}</b><small>{formatCount(selected.topReasonCount)}회 평가에 영향</small></p><button className="primary-button" onClick={() => onToast(`${selected.name} 정보 확인 작업을 만들었습니다.`)}>정보 확인 작업 만들기</button></div></aside></div>}
  </div>;
}

function SessionsView({ questions }: { questions: QuestionJourney[] }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = [...questions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).filter((question) => !search || question.questionId.toLowerCase().includes(search.toLowerCase()) || question.anonymousUserId.toLowerCase().includes(search.toLowerCase())).slice(0, 80);
  const selected = questions.find((question) => question.questionId === selectedId);
  const events = selected ? SYNTHETIC_EVENTS.filter((event) => event.questionId === selected.questionId).sort((a, b) => a.sequence - b.sequence) : [];
  return <div className="view-stack sessions-page">
    <section className="panel sessions-panel">
      <ResultHeader eyebrow="개인정보를 줄인 익명 기록" title="질문 한 건이 실제로 어떤 순서로 처리됐나요?" description="질문 원문·약명·개인 건강 원시값은 보이지 않습니다. 이벤트 시각, 버전, 통제된 결정 이유만 확인합니다." />
      <div className="session-toolbar"><label className="table-search"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="질문 처리 ID 또는 익명 사용자 ID 검색" /></label><button className="control-button"><Icon name="filter" size={15} />열 필터 0</button><span>{formatCount(questions.length)}건 중 최근 {formatCount(rows.length)}건 표시</span></div>
      <div className="data-table-wrap"><table className="data-table sessions-table"><thead><tr><th>질문 처리 ID</th><th>시작 시각</th><th>구체적인 질문 목적</th><th>유입 경로</th><th>방문</th><th>기록 상태</th><th>최종 안내</th><th>처리 시간</th><th>행동</th></tr></thead><tbody>{rows.map((question) => <tr key={question.questionId} onClick={() => setSelectedId(question.questionId)}><td><b className="mono">{question.questionId}</b><small>{question.anonymousUserId}</small></td><td>{new Date(question.startedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Seoul" })}</td><td>{VALUE_LABELS.intentClusters[question.context.intentCluster]}</td><td>{VALUE_LABELS.channels[question.context.channel]}<small>{VALUE_LABELS.devices[question.context.device]}</small></td><td><span className="subtle-tag">{VALUE_LABELS.visitTypes[question.context.visitType]}</span></td><td><span className={`quality-tag ${question.context.dataQualityBand}`}>{VALUE_LABELS.quality[question.context.dataQualityBand]}</span><small>기준 {question.context.baselineDays}일</small></td><td><b>{VALUE_LABELS.decisions[question.decision]}</b><small>{question.reasonCodes.slice(0, 1).map((code) => REASON_LABELS[code] ?? code)}</small></td><td className="num">{question.context.totalLatencyMs.toLocaleString()}ms</td><td><button className="row-action">기록 보기 <Icon name="arrow" size={13} /></button></td></tr>)}</tbody></table></div>
    </section>
    {selected && <div className="side-drawer-backdrop" onClick={() => setSelectedId(null)}><aside className="side-drawer session-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><span>질문 처리 기록</span><h2>{selected.questionId}</h2><p>{selected.anonymousUserId} · 이 익명 사용자의 {selected.questionNumberForUser}번째 질문</p></div><button className="icon-button" onClick={() => setSelectedId(null)}><Icon name="close" size={18} /></button></div><div className="privacy-note"><Icon name="info" size={15} /><span>질문 원문, 약명·용량, 건강 원시값은 브랜드 화면에 전달하지 않았습니다.</span></div><div className="session-summary"><p><span>질문 목적</span><b>{VALUE_LABELS.intentClusters[selected.context.intentCluster]}</b></p><p><span>최종 안내</span><b>{VALUE_LABELS.decisions[selected.decision]}</b></p><p><span>엔진 / 질문 분석기</span><b>v{selected.context.engineVersion} / {selected.context.parserVersion}</b></p><p><span>전체 처리 시간</span><b>{selected.context.totalLatencyMs.toLocaleString()}ms</b></p></div><div className="drawer-section"><h3>실제 이벤트 순서</h3><div className="event-timeline">{events.map((event, index) => { const previous = events[index - 1]; const gap = previous ? Date.parse(event.timestamp) - Date.parse(previous.timestamp) : 0; return <details key={event.eventId} className="timeline-event" open={index === 0 || event.name === "decision_completed"}><summary><span className={`timeline-dot ${event.name === "safety_checked" && event.properties.safetyResult === "stopped" ? "stop" : ""}`} /><div><b>{EVENT_LABELS[event.name]}</b><small>{new Date(event.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, timeZone: "Asia/Seoul" })}{index > 0 ? ` · +${gap}ms` : ""}</small></div><em>#{event.sequence}</em></summary><div className="event-detail"><p>{EVENT_DEFINITIONS[event.name]}</p><pre>{safeJson(event)}</pre></div></details>; })}</div></div></aside></div>}
  </div>;
}

function InsightsView({ questions, previous, onNavigate, onSaveCohort }: { questions: QuestionJourney[]; previous: QuestionJourney[]; onNavigate: (view: ViewId) => void; onSaveCohort: (name: string, size: number) => void }) {
  const stats = computeStats(questions);
  const prev = computeStats(previous);
  const short = questions.filter((q) => q.context.baselineDays < 28 && q.decision === "need_more_information");
  const shortPrev = previous.filter((q) => q.context.baselineDays < 28 && q.decision === "need_more_information");
  const p05 = productRows(questions).find((row) => row.productId === "P05")!;
  const clarified = questions.filter((q) => q.context.clarificationCount > 0);
  const noClarify = questions.filter((q) => q.context.clarificationCount === 0);
  const diff = computeStats(clarified).evidenceRate - computeStats(noClarify).evidenceRate;
  const cards = [
    { severity: "high", title: `기준 기록 28일 미만 질문의 판단 보류가 ${deltaLabel(short.length, shortPrev.length)} 변했습니다.`, observation: `현재 ${formatCount(short.length)}건, 이전 같은 기간 ${formatCount(shortPrev.length)}건입니다. 전체 질문의 ${formatPercent(pct(short.length, questions.length))}를 차지합니다.`, driver: "모바일·재방문 사용자와 엔진 1.4.0 구간에서 증가분이 큽니다.", caveat: "같은 기간 질문 분석기와 엔진 버전도 바뀌었으므로 새 기기나 한 버전이 원인이라고 단정할 수 없습니다.", action: "기준 기록 길이 × 엔진 버전으로 나누어 확인", view: "questions" as ViewId, size: short.length },
    { severity: "medium", title: `${p05.name}은 상품 정보 확인 문제로 ${formatCount(p05.excluded + p05.review)}회 적격 평가에서 빠졌습니다.`, observation: `검토 대상 ${formatCount(p05.candidates)}회 중 적격률 ${formatPercent(p05.eligibleRate)}, 실제 노출 ${formatCount(p05.shown)}회입니다.`, driver: `${REASON_LABELS[p05.topReason] ?? p05.topReason}이 가장 많은 이유였습니다.`, caveat: "상품 정보를 갱신하면 다시 평가할 수 있지만, 사용자 조건과 근거 평가에 따라 여전히 제외될 수 있습니다.", action: "상품별 평가 원장 열기", view: "products" as ViewId, size: p05.candidates },
    { severity: "low", title: `추가 질문을 완료한 사용자의 근거 열람률이 ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%p 다릅니다.`, observation: `추가 질문 있음 ${formatPercent(computeStats(clarified).evidenceRate)}, 추가 질문 없음 ${formatPercent(computeStats(noClarify).evidenceRate)}입니다.`, driver: "식사량 감소와 성분·알레르기 질문에서 차이가 가장 큽니다.", caveat: "질문 난이도와 의도가 서로 달라 추가 질문 자체의 효과로 해석할 수 없습니다.", action: "여정에서 두 집단 비교", view: "journeys" as ViewId, size: clarified.length },
  ];
  return <div className="view-stack insights-page">
    <section className="insights-intro"><div><span>선택 기간 요약</span><h2>수치 변화보다 먼저, 확인할 질문 3개를 찾았습니다.</h2><p>모든 문장은 합성 이벤트에서 다시 계산했습니다. 관찰, 표본, 가능한 설명, 인과로 말할 수 없는 범위를 분리합니다.</p></div><div><p><span>질문</span><b>{formatCount(stats.questions)}</b></p><p><span>이전 기간 대비 노출률</span><b>{deltaLabel(stats.exposureRate, prev.exposureRate, true)}</b></p><p><span>데이터 최신 시각</span><b>3분 전</b></p></div></section>
    <div className="insight-feed">{cards.map((card, index) => <article key={card.title} className={`evidence-insight ${card.severity}`}><div className="insight-rank">0{index + 1}</div><div className="insight-main"><span>{card.severity === "high" ? "먼저 확인" : card.severity === "medium" ? "상품 정보 기회" : "행동 차이"}</span><h2>{card.title}</h2><div className="insight-blocks"><div><b>관찰</b><p>{card.observation}</p></div><div><b>영향이 큰 집단</b><p>{card.driver}</p></div><div><b>주의할 해석</b><p>{card.caveat}</p></div></div><div className="insight-meta"><span>표본 n={formatCount(card.size)}</span><span>이전 같은 기간 비교</span><span>합성 이벤트 전체 계산</span></div><div className="insight-actions"><button className="primary-button" onClick={() => onNavigate(card.view)}>{card.action}<Icon name="arrow" size={14} /></button><button className="secondary-button" onClick={() => onSaveCohort(card.title.slice(0, 24), card.size)}><Icon name="users" size={14} /> 고객 그룹 저장</button><button className="secondary-button"><Icon name="plus" size={14} /> 모니터</button></div></div></article>)}</div>
  </div>;
}

function DataView({ questions }: { questions: QuestionJourney[] }) {
  const events = questionEvents(questions);
  const [tab, setTab] = useState<"events" | "fields" | "privacy">("events");
  const dates = new Set(questions.map((q) => q.context.questionDate));
  return <div className="view-stack data-page">
    <div className="metric-grid four"><MetricCard label="수집 이벤트" value={formatCount(events.length)} help="선택 기간과 조건에 맞는 합성 이벤트 원장의 행 수입니다." /><MetricCard label="공식 이벤트 종류" value={`${Object.keys(EVENT_LABELS).length}개`} help="이름·설명·owner가 정해진 이벤트 종류입니다." /><MetricCard label="수집된 날짜" value={`${dates.size}일`} help="선택 기간 중 질문 이벤트가 하나 이상 있는 날짜 수입니다." /><MetricCard label="민감 원문 필드" value="0개" compareValue="질문 원문·약명·건강 원시값 미수집" help="브랜드 이벤트 allowlist에서 금지한 필드입니다." tone="good" /></div>
    <section className="panel data-catalog-panel"><ResultHeader eyebrow="데이터 사전" title="이 숫자는 어떤 이벤트와 속성으로 만들어졌나요?" description="사람이 읽는 이름, 원본 code, 집계 정의와 현재 수집 상태를 함께 관리합니다." /><div className="table-filter-row"><div className="chart-tabs"><button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>이벤트</button><button className={tab === "fields" ? "active" : ""} onClick={() => setTab("fields")}>속성</button><button className={tab === "privacy" ? "active" : ""} onClick={() => setTab("privacy")}>개인정보 경계</button></div><span>모든 항목 · 표본 추출 없음</span></div>
      {tab === "events" && <div className="data-table-wrap"><table className="data-table dictionary-table"><thead><tr><th>화면 이름</th><th>원본 이벤트 코드</th><th>뜻</th><th>선택 기간 이벤트</th><th>질문 도달률</th><th>마지막 수집</th><th>상태</th></tr></thead><tbody>{(Object.keys(EVENT_LABELS) as EventName[]).map((name) => { const count = events.filter((event) => event.name === name).length; const qCount = new Set(events.filter((event) => event.name === name).map((event) => event.questionId)).size; return <tr key={name}><td><b>{EVENT_LABELS[name]}</b></td><td><code>{name}</code></td><td>{EVENT_DEFINITIONS[name]}</td><td className="num">{formatCount(count)}</td><td className="num">{formatPercent(pct(qCount, questions.length))}</td><td>3분 전</td><td><span className="official-tag"><Icon name="check" size={12} />공식</span></td></tr>; })}</tbody></table></div>}
      {tab === "fields" && <div className="data-table-wrap"><table className="data-table dictionary-table"><thead><tr><th>화면 이름</th><th>원본 속성 코드</th><th>뜻</th><th>형식</th><th>민감도</th><th>상태</th></tr></thead><tbody>{(Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).map((field) => <tr key={field}><td><b>{FIELD_LABELS[field]}</b></td><td><code>{field}</code></td><td>{FIELD_DEFINITIONS[field]}</td><td>통제된 값</td><td><span className="subtle-tag">집계 허용</span></td><td><span className="official-tag"><Icon name="check" size={12} />공식</span></td></tr>)}</tbody></table></div>}
      {tab === "privacy" && <div className="privacy-boundaries"><div className="privacy-allowed"><span>브랜드 분석에 허용</span><h3>집계와 결정 재현에 필요한 최소 코드</h3><ul><li>회전 가능한 익명 사용자·질문 처리 ID</li><li>질문 목적과 최종 안내 코드</li><li>상품 ID, 적격 상태, 결정 이유</li><li>이벤트 시각·순서·엔진/파서 버전</li><li>모바일/데스크톱, 넓은 지역 구간, 유입 채널</li></ul></div><div className="privacy-blocked"><span>브랜드 분석에서 금지</span><h3>개인 건강과 직접 식별 정보</h3><ul><li>질문 원문과 자유 입력 전체</li><li>약명, 용량, 진단명, 증상 문장</li><li>개인 wearable 원시 시계열</li><li>이름, 이메일, 전화번호, 정확한 위치</li><li>최소 인원 미만 조합의 사용자 목록</li></ul></div></div>}
    </section>
  </div>;
}

export default function ProductApp() {
  const [view, setView] = useState<ViewId>("home");
  const [date, setDate] = useState<DateRangeValue>({ preset: "30d", start: "2026-09-04", end: "2026-10-03", compare: "previous" });
  const [segment, setSegment] = useState<SegmentId>("all");
  const [interval, setInterval] = useState("day");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [filterPanel, setFilterPanel] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [group, setGroup] = useState<GroupId>("intentCluster");
  const [measure, setMeasure] = useState<MeasureId>("questions");
  const [funnelStage, setFunnelStage] = useState("shown");
  const [funnelOrder, setFunnelOrder] = useState("this");
  const [journeyNode, setJourneyNode] = useState("");
  const [cohorts, setCohorts] = useState<SavedCohort[]>(DEFAULT_COHORTS);
  const [toast, setToast] = useState<string | null>(null);
  const [activeRules, setActiveRules] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<FilterLogic>("all");
  const [draftRules, setDraftRules] = useState<FilterRule[]>([]);
  const [draftLogic, setDraftLogic] = useState<FilterLogic>("all");

  useEffect(() => {
    const applyUrlState = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get("view") === "overview" ? "home" : params.get("view");
      if (requestedView && NAV.flatMap((item) => item.items).some((item) => item.id === requestedView && item.id !== "engine")) setView(requestedView as ViewId);
      const requestedRange = params.get("range");
      if (requestedRange && /^\d+$/.test(requestedRange)) {
        const days = Math.max(1, Math.min(90, Number(requestedRange)));
        const end = new Date("2026-10-03T12:00:00+09:00");
        const start = new Date(end);
        start.setDate(start.getDate() - days + 1);
        setDate((current) => ({ ...current, preset: `${days}d`, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }));
      }
    };
    window.addEventListener("popstate", applyUrlState);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return () => window.removeEventListener("popstate", applyUrlState);
  }, []);

  const questions = useMemo(() => filterQuestions(date.start, date.end, segment, activeRules, filterLogic), [activeRules, date.end, date.start, filterLogic, segment]);
  const prevRange = useMemo(() => previousRange(date), [date]);
  const previous = useMemo(() => date.compare === "none" ? [] : filterQuestions(prevRange.start, prevRange.end, segment, activeRules, filterLogic), [activeRules, date.compare, filterLogic, prevRange.end, prevRange.start, segment]);
  const draftEstimate = useMemo(() => filterQuestions(date.start, date.end, segment, draftRules, draftLogic), [date.end, date.start, draftLogic, draftRules, segment]);

  const syncUrl = (nextView: ViewId, nextDate: DateRangeValue) => {
    const params = new URLSearchParams(window.location.search);
    params.set("view", nextView === "home" ? "overview" : nextView);
    params.set("range", String(dayDifference(nextDate.start, nextDate.end)));
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  };
  const navigate = (target: ViewId) => { setView(target); syncUrl(target, date); setSearchOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const updateDate = (nextDate: DateRangeValue) => { setDate(nextDate); syncUrl(view, nextDate); };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 3200); };
  const saveCohort = (name: string, size: number) => {
    const cohort: SavedCohort = { id: `C-${String(cohorts.length + 1).padStart(2, "0")}`, name, description: "선택한 분석 지점 또는 경로에서 생성", size, change: 0, type: "경로", owner: "나", updated: "방금", privacyReady: size >= 30 };
    setCohorts([cohort, ...cohorts]);
    notify(`고객 그룹 “${name}”을 저장했습니다.`);
  };
  const openFilterPanel = () => {
    setDraftRules(activeRules);
    setDraftLogic(filterLogic);
    setFilterPanel(true);
  };
  const addFilterRule = () => setDraftRules((rules) => [...rules, { id: `rule-${Date.now()}-${rules.length}`, field: "device", value: "mobile" }]);
  const updateFilterRule = (id: string, update: Partial<FilterRule>) => setDraftRules((rules) => rules.map((rule) => rule.id === id ? { ...rule, ...update } : rule));
  const copy = VIEW_COPY[view];

  return <div className="analytics-app">
    <header className="app-topbar">
      <a className="app-brand" href="#" onClick={(event) => { event.preventDefault(); navigate("home"); }}><span>L</span><b>Lumen</b></a>
      <div className="global-search">
        <Icon name="search" size={16} />
        <input value={globalSearch} onFocus={() => setSearchOpen(true)} onChange={(event) => { setGlobalSearch(event.target.value); setSearchOpen(true); }} placeholder="분석, 고객 그룹 또는 질문 ID 검색" />
        <kbd>⌘ K</kbd>
        {searchOpen && <div className="search-popover"><div className="search-section"><span>{globalSearch ? "검색 결과" : "빠른 이동"}</span>{NAV.flatMap((groupItem) => groupItem.items).filter((item) => item.id !== "engine" && (!globalSearch || item.label.includes(globalSearch))).slice(0, 6).map((item) => <button key={item.id} onClick={() => navigate(item.id as ViewId)}><Icon name={item.icon} size={16} /><span><b>{item.label}</b><small>{item.id === "sessions" ? "익명 질문의 실제 이벤트 순서" : "분석 화면 열기"}</small></span><em>열기</em></button>)}</div><div className="search-foot">질문 원문과 개인 건강값은 검색할 수 없습니다.</div></div>}
      </div>
      <div className="topbar-actions"><span className="data-scope">2026.10.03 합성 데이터</span><button className="top-create"><Icon name="plus" size={15} />새 분석</button><button className="avatar" aria-label="내 계정">LM</button></div>
    </header>

    <aside className="app-sidebar">
      <button className="workspace-switch"><span className="workspace-mark">BR</span><span><b>브랜드 분석</b><small>Lumen demo</small></span><Icon name="chevron" size={15} /></button>
      <nav>{NAV.map((groupItem) => <div className="nav-group" key={groupItem.label}><span>{groupItem.label}</span>{groupItem.items.map((item) => item.id === "engine" ? <a key={item.id} href="/engine-guide"><Icon name={item.icon} size={17} />{item.label}<Icon name="external" size={13} /></a> : <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id as ViewId)}><Icon name={item.icon} size={17} /><span>{item.label}</span>{item.note && <em>{item.note}</em>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><button onClick={() => navigate("data")}><Icon name="database" size={15} /><span>{formatCount(SYNTHETIC_EVENTS.length)} 이벤트</span></button></div>
    </aside>

    <main className="app-main" onClick={() => { if (searchOpen) setSearchOpen(false); }}>
      <div className="page-header">
        <div className="page-title"><div className="title-meta"><span>브랜드 분석</span><Icon name="chevron" size={12} /></div><h1>{copy.title}</h1><p>{copy.subtitle}</p></div>
        <div className="page-actions"><button className="secondary-button" onClick={() => notify("현재 분석 링크를 복사했습니다.")}>공유</button><button className="secondary-button" onClick={() => notify("현재 분석을 저장했습니다.")}><Icon name="save" size={14} />저장</button><button className="icon-button" aria-label="페이지 메뉴"><Icon name="more" size={17} /></button></div>
      </div>
      <Toolbar date={date} onDate={updateDate} segment={segment} onSegment={setSegment} interval={interval} onInterval={setInterval} openMenu={openMenu} setOpenMenu={setOpenMenu} onOpenFilters={openFilterPanel} filterCount={activeRules.length} />

      <div className="page-content">
        {view === "home" && <Overview questions={questions} previous={previous} interval={interval} onNavigate={navigate} onToast={notify} />}
        {view === "questions" && <QuestionsView questions={questions} date={date} interval={interval} group={group} setGroup={setGroup} measure={measure} setMeasure={setMeasure} openMenu={openMenu} setOpenMenu={setOpenMenu} onToast={notify} />}
        {view === "funnel" && <FunnelView questions={questions} selectedStage={funnelStage} setSelectedStage={setFunnelStage} order={funnelOrder} setOrder={setFunnelOrder} openMenu={openMenu} setOpenMenu={setOpenMenu} onSaveCohort={saveCohort} />}
        {view === "journeys" && <JourneysView questions={questions} selectedNode={journeyNode} setSelectedNode={setJourneyNode} openMenu={openMenu} setOpenMenu={setOpenMenu} onSaveCohort={saveCohort} />}
        {view === "cohorts" && <CohortsView cohorts={cohorts} setCohorts={setCohorts} questions={questions} openMenu={openMenu} setOpenMenu={setOpenMenu} onToast={notify} />}
        {view === "products" && <ProductsView questions={questions} onToast={notify} />}
        {view === "sessions" && <SessionsView questions={questions} />}
        {view === "insights" && <InsightsView questions={questions} previous={previous} onNavigate={navigate} onSaveCohort={saveCohort} />}
        {view === "data" && <DataView questions={questions} />}
      </div>
    </main>

    {filterPanel && <div className="side-drawer-backdrop" onClick={() => setFilterPanel(false)}><aside className="side-drawer filter-drawer" onClick={(event) => event.stopPropagation()}>
      <div className="drawer-head"><div><span>모든 화면에 적용</span><h2>분석 조건</h2><p>사람이 읽는 조건을 조합하면 모든 차트와 표를 같은 원장에서 다시 계산합니다.</p></div><button className="icon-button" onClick={() => setFilterPanel(false)}><Icon name="close" size={18} /></button></div>
      <div className="filter-logic"><span>여러 조건이 있을 때</span><div className="mini-segmented"><button className={draftLogic === "all" ? "active" : ""} onClick={() => setDraftLogic("all")}>모두 만족</button><button className={draftLogic === "any" ? "active" : ""} onClick={() => setDraftLogic("any")}>하나 이상 만족</button></div></div>
      <div className="filter-rules">
        {draftRules.length === 0 && <div className="filter-empty"><Icon name="filter" size={20} /><b>아직 세부 조건이 없습니다.</b><span>아래 버튼으로 기기, 방문 상태, 기록 길이, 유입 경로 또는 상품 노출 조건을 추가하세요.</span></div>}
        {draftRules.map((rule, index) => <div className="filter-rule-editor" key={rule.id}>
          <span className="rule-index">{index + 1}</span>
          <div className="filter-rule-controls">
            <ChoiceMenu id={`filter-field-${rule.id}`} label="무엇을 볼까요?" value={rule.field} options={FILTER_FIELD_OPTIONS} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={(value) => { const field = value as FilterField; updateFilterRule(rule.id, { field, value: FILTER_VALUE_OPTIONS[field][0].value }); }} />
            <span className="filter-operator">다음과 같음</span>
            <ChoiceMenu id={`filter-value-${rule.id}`} label="어떤 값인가요?" value={rule.value} options={FILTER_VALUE_OPTIONS[rule.field]} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={(value) => updateFilterRule(rule.id, { value })} />
          </div>
          <button className="icon-button remove-rule" onClick={() => setDraftRules((rules) => rules.filter((item) => item.id !== rule.id))} aria-label={`${index + 1}번 조건 삭제`}><Icon name="close" size={15} /></button>
        </div>)}
      </div>
      <button className="add-filter-rule" onClick={addFilterRule}><Icon name="plus" size={15} /> 조건 추가</button>
      <div className="filter-estimate"><span>이 조건에 맞는 질문</span><strong>{formatCount(draftEstimate.length)}건</strong><small>{formatPercent(pct(draftEstimate.length, filterQuestions(date.start, date.end, segment).length))} · 적용하기 전 예상값</small></div>
      <div className="drawer-footer"><button className="secondary-button" onClick={() => setFilterPanel(false)}>취소</button><button className="secondary-button" onClick={() => { const users = new Set(draftEstimate.map((q) => q.anonymousUserId)).size; saveCohort("현재 분석 조건", users); }}>고객 그룹으로 저장</button><button className="primary-button" onClick={() => { setActiveRules(draftRules); setFilterLogic(draftLogic); setFilterPanel(false); notify(`${draftRules.length}개 조건을 적용했습니다.`); }}>조건 적용</button></div>
    </aside></div>}
    {toast && <div className="toast"><span><Icon name="check" size={15} /></span>{toast}</div>}
  </div>;
}
