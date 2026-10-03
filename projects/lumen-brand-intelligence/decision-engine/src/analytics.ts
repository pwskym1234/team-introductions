import type { BrandAggregate, EngineEvent, IsoDateTime } from "./types.ts";

export const SAFE_ENGINE_EVENT_FIELDS = [
  "eventId",
  "eventName",
  "occurredAt",
  "eventSequence",
  "journeyId",
  "anonymousUserId",
  "anonymousSessionId",
  "scenarioId",
  "requestScope",
  "consentPolicyVersion",
  "synthetic",
  "intentCode",
  "verdictCode",
  "productId",
  "reasonCode",
  "engineVersion",
  "ruleVersion",
  "evidenceVersion",
] as const;

export const ENGINE_EVENT_NAMES = [
  "chat_question_asked",
  "chat_intent_classified",
  "clarification_answered",
  "safety_check_passed",
  "guardrail_blocked",
  "engine_verdict_generated",
  "candidate_generated",
  "candidate_eligible",
  "recommendation_ranked",
  "candidate_filtered",
  "candidate_data_gap",
  "candidate_diversity_held",
  "recommendation_impression",
  "evidence_opened",
  "product_clicked",
] as const;

export type EngineEventName = (typeof ENGINE_EVENT_NAMES)[number];

export const FUNNEL_STAGES = [
  { stage: "question_asked", eventName: "chat_question_asked" },
  { stage: "intent_classified", eventName: "chat_intent_classified" },
  { stage: "clarification_completed", eventName: "clarification_answered" },
  { stage: "safety_passed", eventName: "safety_check_passed" },
  { stage: "candidate_generated", eventName: "candidate_generated" },
  { stage: "recommendation_impression", eventName: "recommendation_impression" },
  { stage: "evidence_opened", eventName: "evidence_opened" },
  { stage: "product_clicked", eventName: "product_clicked" },
] as const satisfies ReadonlyArray<{ stage: string; eventName: EngineEventName }>;

const safeFieldSet = new Set<string>(SAFE_ENGINE_EVENT_FIELDS);
const eventNameSet = new Set<string>(ENGINE_EVENT_NAMES);
const sensitiveKeyFragments = [
  "questiontext",
  "rawquestion",
  "symptom",
  "medication",
  "dose",
  "metric",
  "heartrate",
  "hrv",
  "sleep",
  "weight",
  "diagnosis",
  "allergy",
  "userid",
  "email",
  "phone",
  "name",
  "freeform",
  "transcript",
];

const requiredStringFields = [
  "eventId",
  "eventName",
  "occurredAt",
  "journeyId",
  "anonymousUserId",
  "anonymousSessionId",
  "scenarioId",
  "requestScope",
  "consentPolicyVersion",
  "engineVersion",
  "ruleVersion",
  "evidenceVersion",
] as const;

const optionalCodeFields = ["intentCode", "verdictCode", "reasonCode"] as const;
const productEventNames = new Set<EngineEventName>([
  "candidate_generated",
  "candidate_eligible",
  "recommendation_ranked",
  "candidate_filtered",
  "candidate_data_gap",
  "candidate_diversity_held",
  "recommendation_impression",
  "evidence_opened",
  "product_clicked",
]);

export const PRODUCT_DATA_GAP_REASON_CODES = [
  "ALLERGEN_DECLARATION_MISSING",
  "LABEL_MISSING",
  "EVIDENCE_MISSING",
  "PRICE_MISSING",
  "DATA_FRESHNESS_MISSING",
  "PRODUCT_DATA_STALE",
  "STOCK_UNKNOWN",
] as const;

const productDataGapReasonSet = new Set<string>(PRODUCT_DATA_GAP_REASON_CODES);

const codePattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const opaqueIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const productIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export class UnsafeAnalyticsEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeAnalyticsEventError";
  }
}

export type ProductAnalyticsSummary = BrandAggregate["productGaps"][number] & {
  dataGapCount: number;
  dataGapReasons: Array<{ reasonCode: string; count: number }>;
};

export interface BrandAnalyticsAggregate
  extends Omit<BrandAggregate, "productGaps"> {
  productGaps: ProductAnalyticsSummary[];
  dataGaps: Array<{ reasonCode: string; count: number }>;
  sourceEventCount: number;
  sourceSessionCount: number;
  sourceUserCount: number;
  returningUserCount: number;
  syntheticEventCount: number;
  nonSyntheticEventCount: number;
}

export type EngineEventDraft = Omit<EngineEvent, "eventName"> & {
  eventName: EngineEventName;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return sensitiveKeyFragments.some((fragment) => normalized.includes(fragment));
}

function requiredString(
  value: Record<string, unknown>,
  field: (typeof requiredStringFields)[number],
): string {
  const candidate = value[field];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new UnsafeAnalyticsEventError(`${field} must be a non-empty string`);
  }
  return candidate;
}

function optionalString(
  value: Record<string, unknown>,
  field: "intentCode" | "verdictCode" | "productId" | "reasonCode",
): string | undefined {
  const candidate = value[field];
  if (candidate === undefined) return undefined;
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new UnsafeAnalyticsEventError(`${field} must be a non-empty string when present`);
  }
  return candidate;
}

/**
 * Converts an untrusted object into the deliberately narrow analytics event
 * contract. Harmless unknown metadata is dropped; any key that resembles raw
 * health or identity data causes rejection instead of silent collection.
 */
export function sanitizeEngineEvent(input: unknown): EngineEvent {
  if (!isRecord(input)) {
    throw new UnsafeAnalyticsEventError("analytics event must be an object");
  }

  const forbiddenKeys = Object.keys(input).filter(
    (key) => !safeFieldSet.has(key) && isSensitiveKey(key),
  );
  if (forbiddenKeys.length > 0) {
    throw new UnsafeAnalyticsEventError(
      `analytics event contains forbidden fields: ${forbiddenKeys.sort().join(", ")}`,
    );
  }

  const eventId = requiredString(input, "eventId");
  const eventName = requiredString(input, "eventName");
  const occurredAt = requiredString(input, "occurredAt") as IsoDateTime;
  const journeyId = requiredString(input, "journeyId");
  const anonymousUserId = requiredString(input, "anonymousUserId");
  const anonymousSessionId = requiredString(input, "anonymousSessionId");
  const scenarioId = requiredString(input, "scenarioId");
  const requestScope = requiredString(input, "requestScope");
  const consentPolicyVersion = requiredString(input, "consentPolicyVersion");
  const engineVersion = requiredString(input, "engineVersion");
  const ruleVersion = requiredString(input, "ruleVersion");
  const evidenceVersion = requiredString(input, "evidenceVersion");

  if (!opaqueIdPattern.test(eventId)) {
    throw new UnsafeAnalyticsEventError("eventId must be an opaque identifier");
  }
  if (!eventNameSet.has(eventName)) {
    throw new UnsafeAnalyticsEventError(`eventName is not allowlisted: ${eventName}`);
  }
  if (Number.isNaN(Date.parse(occurredAt))) {
    throw new UnsafeAnalyticsEventError("occurredAt must be an ISO-compatible timestamp");
  }
  if (
    !opaqueIdPattern.test(journeyId) ||
    !opaqueIdPattern.test(anonymousUserId) ||
    !opaqueIdPattern.test(anonymousSessionId) ||
    !opaqueIdPattern.test(scenarioId)
  ) {
    throw new UnsafeAnalyticsEventError(
      "journeyId, anonymousUserId, anonymousSessionId and scenarioId must be opaque identifiers",
    );
  }
  if (requestScope !== "brand_aggregate") {
    throw new UnsafeAnalyticsEventError("requestScope must be brand_aggregate");
  }
  if (
    !versionPattern.test(consentPolicyVersion) ||
    !versionPattern.test(engineVersion) ||
    !versionPattern.test(ruleVersion) ||
    !versionPattern.test(evidenceVersion)
  ) {
    throw new UnsafeAnalyticsEventError("version fields must be bounded identifiers");
  }
  if (typeof input.synthetic !== "boolean") {
    throw new UnsafeAnalyticsEventError("synthetic must be boolean");
  }
  if (!Number.isInteger(input.eventSequence) || (input.eventSequence as number) < 1) {
    throw new UnsafeAnalyticsEventError("eventSequence must be a positive integer");
  }
  const eventSequence = input.eventSequence as number;

  const intentCode = optionalString(input, "intentCode");
  const verdictCode = optionalString(input, "verdictCode");
  const productId = optionalString(input, "productId");
  const reasonCode = optionalString(input, "reasonCode");

  for (const [field, value] of optionalCodeFields.map(
    (field) => [field, input[field]] as const,
  )) {
    if (value !== undefined && (typeof value !== "string" || !codePattern.test(value))) {
      throw new UnsafeAnalyticsEventError(`${field} must be a controlled code`);
    }
  }
  if (productId !== undefined && !productIdPattern.test(productId)) {
    throw new UnsafeAnalyticsEventError("productId must be a bounded product identifier");
  }

  const typedEventName = eventName as EngineEventName;
  if (productEventNames.has(typedEventName) && productId === undefined) {
    throw new UnsafeAnalyticsEventError(`${eventName} requires productId`);
  }
  if (typedEventName === "engine_verdict_generated" && verdictCode === undefined) {
    throw new UnsafeAnalyticsEventError("engine_verdict_generated requires verdictCode");
  }
  if (
    (typedEventName === "candidate_filtered" ||
      typedEventName === "candidate_data_gap" ||
      typedEventName === "candidate_diversity_held") &&
    reasonCode === undefined
  ) {
    throw new UnsafeAnalyticsEventError(`${eventName} requires reasonCode`);
  }

  return {
    eventId,
    eventName,
    occurredAt,
    eventSequence,
    journeyId,
    anonymousUserId,
    anonymousSessionId,
    scenarioId,
    requestScope: "brand_aggregate",
    consentPolicyVersion,
    synthetic: input.synthetic,
    ...(intentCode === undefined ? {} : { intentCode }),
    ...(verdictCode === undefined ? {} : { verdictCode }),
    ...(productId === undefined ? {} : { productId }),
    ...(reasonCode === undefined ? {} : { reasonCode }),
    engineVersion,
    ruleVersion,
    evidenceVersion,
  };
}

export function createEngineEvent(draft: EngineEventDraft): EngineEvent {
  return sanitizeEngineEvent(draft);
}

export function validateSafeEngineEvent(input: unknown): asserts input is EngineEvent {
  sanitizeEngineEvent(input);
  if (isRecord(input)) {
    const unknownKeys = Object.keys(input).filter((key) => !safeFieldSet.has(key));
    if (unknownKeys.length > 0) {
      throw new UnsafeAnalyticsEventError(
        `analytics event contains non-allowlisted fields: ${unknownKeys.sort().join(", ")}`,
      );
    }
  }
}

function canonicalEvent(event: EngineEvent): string {
  return JSON.stringify(
    SAFE_ENGINE_EVENT_FIELDS.map((field) => [field, event[field] ?? null]),
  );
}

function deduplicateEvents(events: readonly unknown[]): EngineEvent[] {
  const byId = new Map<string, EngineEvent>();
  for (const rawEvent of events) {
    const event = sanitizeEngineEvent(rawEvent);
    const previous = byId.get(event.eventId);
    if (previous === undefined) {
      byId.set(event.eventId, event);
      continue;
    }
    if (canonicalEvent(previous) !== canonicalEvent(event)) {
      throw new UnsafeAnalyticsEventError(
        `duplicate eventId has conflicting content: ${event.eventId}`,
      );
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      a.occurredAt.localeCompare(b.occurredAt) ||
      a.eventSequence - b.eventSequence ||
      a.eventId.localeCompare(b.eventId),
  );
}

function sessionKey(event: EngineEvent): string {
  return `${event.anonymousSessionId}\u0000${event.scenarioId}`;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedCounts(
  counts: ReadonlyMap<string, number>,
  keyName: "code" | "reasonCode",
): Array<{ code: string; count: number }> | Array<{ reasonCode: string; count: number }> {
  const rows = [...counts].sort(
    ([keyA, countA], [keyB, countB]) => countB - countA || keyA.localeCompare(keyB),
  );
  return keyName === "code"
    ? rows.map(([code, count]) => ({ code, count }))
    : rows.map(([reasonCode, count]) => ({ reasonCode, count }));
}

function uniqueProductCount(
  events: readonly EngineEvent[],
  eventNames: EngineEventName | readonly EngineEventName[],
  productId: string,
): number {
  const names = new Set(Array.isArray(eventNames) ? eventNames : [eventNames]);
  return new Set(
    events
      .filter((event) => names.has(event.eventName as EngineEventName) && event.productId === productId)
      .map((event) => `${sessionKey(event)}\u0000${event.productId}`),
  ).size;
}

/** Builds the privacy-safe, deterministic read model consumed by the brand UI. */
export function aggregateBrandEvents(
  rawEvents: readonly unknown[],
  generatedAt: IsoDateTime,
): BrandAnalyticsAggregate {
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new UnsafeAnalyticsEventError("generatedAt must be an ISO-compatible timestamp");
  }

  const events = deduplicateEvents(rawEvents);
  const eventsBySession = new Map<string, EngineEvent[]>();
  for (const event of events) {
    const key = sessionKey(event);
    const sessionEvents = eventsBySession.get(key);
    if (sessionEvents) sessionEvents.push(event);
    else eventsBySession.set(key, [event]);
  }
  for (const sessionEvents of eventsBySession.values()) {
    sessionEvents.sort(
      (a, b) => a.eventSequence - b.eventSequence ||
        a.occurredAt.localeCompare(b.occurredAt) ||
        a.eventId.localeCompare(b.eventId),
    );
  }

  const completedStageCount = (sessionEvents: EngineEvent[], targetStageIndex: number): boolean => {
    let cursor = -1;
    for (let stageIndex = 0; stageIndex <= targetStageIndex; stageIndex += 1) {
      const targetName = FUNNEL_STAGES[stageIndex].eventName;
      const nextIndex = sessionEvents.findIndex(
        (event, index) => index > cursor && event.eventName === targetName,
      );
      if (nextIndex < 0) return false;
      cursor = nextIndex;
    }
    return true;
  };
  const funnel = FUNNEL_STAGES.map(({ stage, eventName }, index) => {
    void eventName;
    const count = [...eventsBySession.values()].filter((sessionEvents) =>
      completedStageCount(sessionEvents, index)
    ).length;
    const denominator = index === 0
      ? null
      : [...eventsBySession.values()].filter((sessionEvents) =>
          completedStageCount(sessionEvents, index - 1)
        ).length;
    return { stage, count, denominator };
  });

  const verdictCounts = new Map<string, number>();
  const exclusionCounts = new Map<string, number>();
  const dataGapCounts = new Map<string, number>();
  const seenDataGaps = new Set<string>();
  for (const event of events) {
    if (event.eventName === "engine_verdict_generated" && event.verdictCode) {
      increment(verdictCounts, event.verdictCode);
    }
    if (event.eventName === "candidate_filtered" && event.reasonCode) {
      increment(exclusionCounts, event.reasonCode);
    }
    const isDataGap =
      event.reasonCode !== undefined &&
      (event.eventName === "candidate_data_gap" ||
        (event.eventName === "candidate_filtered" &&
          productDataGapReasonSet.has(event.reasonCode)));
    if (isDataGap && event.reasonCode && event.productId) {
      const key = `${sessionKey(event)}\u0000${event.productId}\u0000${event.reasonCode}`;
      if (!seenDataGaps.has(key)) {
        seenDataGaps.add(key);
        increment(dataGapCounts, event.reasonCode);
      }
    }
  }

  const productIds = [...new Set(events.flatMap((event) => event.productId ?? []))].sort();
  const productGaps: ProductAnalyticsSummary[] = productIds.map((productId) => {
    const topReasons = new Map<string, number>();
    const dataGapReasons = new Map<string, number>();
    const seenProductDataGaps = new Set<string>();
    const filteredReasonKeys = new Set(
      events
        .filter(
          (event) =>
            event.productId === productId &&
            event.eventName === "candidate_filtered" &&
            event.reasonCode !== undefined,
        )
        .map((event) => `${sessionKey(event)}\u0000${event.reasonCode}`),
    );
    for (const event of events) {
      if (event.productId !== productId || event.reasonCode === undefined) continue;
      const reasonKey = `${sessionKey(event)}\u0000${event.reasonCode}`;
      if (event.eventName === "candidate_filtered") {
        increment(topReasons, event.reasonCode);
      }
      if (event.eventName === "candidate_data_gap") {
        if (!filteredReasonKeys.has(reasonKey)) {
          increment(topReasons, event.reasonCode);
        }
        if (!seenProductDataGaps.has(reasonKey)) {
          seenProductDataGaps.add(reasonKey);
          increment(dataGapReasons, event.reasonCode);
        }
      }
      if (
        event.eventName === "candidate_filtered" &&
        productDataGapReasonSet.has(event.reasonCode)
      ) {
        if (!seenProductDataGaps.has(reasonKey)) {
          seenProductDataGaps.add(reasonKey);
          increment(dataGapReasons, event.reasonCode);
        }
      }
    }
    return {
      productId,
      candidateCount: uniqueProductCount(events, "candidate_generated", productId),
      eligibleCount: uniqueProductCount(
        events,
        ["candidate_eligible", "recommendation_ranked"],
        productId,
      ),
      excludedCount: uniqueProductCount(events, "candidate_filtered", productId),
      dataGapCount: new Set(
        events
          .filter(
            (event) =>
              event.productId === productId &&
              (event.eventName === "candidate_data_gap" ||
                (event.eventName === "candidate_filtered" &&
                  event.reasonCode !== undefined &&
                  productDataGapReasonSet.has(event.reasonCode))),
          )
          .map((event) => `${sessionKey(event)}\u0000${event.productId}`),
      ).size,
      topReasons: sortedCounts(topReasons, "reasonCode") as Array<{
        reasonCode: string;
        count: number;
      }>,
      dataGapReasons: sortedCounts(dataGapReasons, "reasonCode") as Array<{
        reasonCode: string;
        count: number;
      }>,
    };
  });

  const syntheticEventCount = events.filter((event) => event.synthetic).length;
  const nonSyntheticEventCount = events.length - syntheticEventCount;
  const sessionsByUser = new Map<string, Set<string>>();
  for (const event of events) {
    const sessions = sessionsByUser.get(event.anonymousUserId) ?? new Set<string>();
    sessions.add(sessionKey(event));
    sessionsByUser.set(event.anonymousUserId, sessions);
  }

  return {
    synthetic: events.length === 0 || nonSyntheticEventCount === 0,
    generatedAt,
    funnel,
    verdicts: sortedCounts(verdictCounts, "code") as Array<{ code: string; count: number }>,
    exclusions: sortedCounts(exclusionCounts, "reasonCode") as Array<{
      reasonCode: string;
      count: number;
    }>,
    productGaps,
    dataGaps: sortedCounts(dataGapCounts, "reasonCode") as Array<{
      reasonCode: string;
      count: number;
    }>,
    sourceEventCount: events.length,
    sourceSessionCount: eventsBySession.size,
    sourceUserCount: sessionsByUser.size,
    returningUserCount: [...sessionsByUser.values()].filter((sessions) => sessions.size > 1).length,
    syntheticEventCount,
    nonSyntheticEventCount,
  };
}
