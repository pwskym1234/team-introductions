import type {
  DailyMetricObservation,
  EngineConfig,
  EngineInput,
  MedicationEvent,
  MetricChangeAnalysis,
  MetricKey,
} from "./types.ts";

/**
 * Optional controls for the event-aligned analysis.  The engine's ordinary
 * call site only needs EngineInput and EngineConfig; these controls mainly
 * make the statistical assumptions explicit and testable.
 */
export interface MetricAnalysisOptions {
  /** Override the automatically selected latest GLP-1 start/titration event. */
  anchorEvent?: MedicationEvent;
  /** Number of calendar days on each side of the event (default: max(14, 2 * minimum days)). */
  windowDays?: number;
  /** Optional Newey-West lag. If omitted, a standard sample-size rule is used. */
  hacLag?: number;
}

interface WindowPoint {
  date: string;
  value: number;
  unit: string;
  deviceId: string;
  completeness: number;
}

interface PendingAnalysis extends MetricChangeAnalysis {
  rawPForAdjustment: number | null;
}

const DAY_MS = 86_400_000;
const NORMAL_95 = 1.959963984540054;

function dateOrdinal(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isFinite(time) ? Math.floor(time / DAY_MS) : null;
}

function eventDate(event: MedicationEvent): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(event.occurredAt);
  return match?.[1] ?? null;
}

function chooseAnchor(input: EngineInput, override?: MedicationEvent): MedicationEvent | null {
  if (override) return eventDate(override) ? override : null;
  const asOf = Date.parse(input.asOf);
  return input.medicationEvents
    .filter((event) => {
      const time = Date.parse(event.occurredAt);
      return (
        event.medicationClass === "glp1" &&
        (event.kind === "start" || event.kind === "titration") &&
        Number.isFinite(time) &&
        time <= asOf
      );
    })
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0] ?? null;
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const center = mean(values);
  const variance = values.reduce((total, value) => total + (value - center) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

/** Newey-West long-run variance estimate converted to variance of the sample mean. */
function hacVarianceOfMean(values: number[], requestedLag?: number): number | null {
  const n = values.length;
  if (n < 2) return null;
  const center = mean(values);
  const residuals = values.map((value) => value - center);
  const automaticLag = Math.floor(4 * (n / 100) ** (2 / 9));
  const lag = Math.min(n - 1, Math.max(0, requestedLag ?? automaticLag));

  let longRunVariance = residuals.reduce((sum, residual) => sum + residual ** 2, 0) / n;
  for (let offset = 1; offset <= lag; offset += 1) {
    let covariance = 0;
    for (let index = offset; index < n; index += 1) {
      covariance += residuals[index] * residuals[index - offset];
    }
    covariance /= n;
    const bartlettWeight = 1 - offset / (lag + 1);
    longRunVariance += 2 * bartlettWeight * covariance;
  }

  return Math.max(0, longRunVariance) / n;
}

function twoSidedNormalP(z: number): number {
  // Stable complementary-error-function approximation. Computing 1 - CDF
  // loses all precision in the tails and previously produced a literal 0.
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const probability = t * Math.exp(
    -x * x - 1.26551223 + t * (
      1.00002368 + t * (
        0.37409196 + t * (
          0.09678418 + t * (
            -0.18628806 + t * (
              0.27886807 + t * (
                -1.13520398 + t * (
                  1.48851587 + t * (-0.82215223 + t * 0.17087277)
                )
              )
            )
          )
        )
      )
    ),
  );
  return Math.max(Number.MIN_VALUE, Math.min(1, probability));
}

function round(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(digits));
}

function roundProbability(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (value > 0 && value < 0.000001) return Number(value.toPrecision(6));
  return round(value);
}

function magnitudeFor(standardized: number | null): MetricChangeAnalysis["magnitude"] {
  if (standardized === null || !Number.isFinite(standardized)) return "unknown";
  const value = Math.abs(standardized);
  if (value < 0.2) return "none";
  if (value < 0.5) return "small";
  if (value < 0.8) return "moderate";
  return "large";
}

function collapseDuplicateDays(observations: DailyMetricObservation[]): {
  points: WindowPoint[];
  duplicateFound: boolean;
} {
  const grouped = new Map<string, DailyMetricObservation[]>();
  for (const observation of observations) {
    const key = `${observation.date}\u0000${observation.deviceId}\u0000${observation.unit}`;
    const existing = grouped.get(key);
    if (existing) existing.push(observation);
    else grouped.set(key, [observation]);
  }

  let duplicateFound = false;
  const points = [...grouped.values()].map((sameDay) => {
    duplicateFound ||= sameDay.length > 1;
    return {
      date: sameDay[0].date,
      deviceId: sameDay[0].deviceId,
      unit: sameDay[0].unit,
      value: mean(sameDay.map((item) => item.value)),
      completeness: Math.min(...sameDay.map((item) => item.completeness)),
    };
  });
  points.sort((a, b) => a.date.localeCompare(b.date) || a.deviceId.localeCompare(b.deviceId));
  return { points, duplicateFound };
}

function addWarning(warnings: string[], code: string): void {
  if (!warnings.includes(code)) warnings.push(code);
}

function holmAdjust(analyses: PendingAnalysis[]): void {
  const eligible = analyses
    .map((analysis, index) => ({ index, p: analysis.rawPForAdjustment }))
    .filter((item): item is { index: number; p: number } => item.p !== null)
    .sort((a, b) => a.p - b.p || a.index - b.index);

  let runningMaximum = 0;
  eligible.forEach((item, rank) => {
    const adjusted = Math.min(1, item.p * (eligible.length - rank));
    runningMaximum = Math.max(runningMaximum, adjusted);
    analyses[item.index].adjustedPValue = roundProbability(runningMaximum);
  });
}

function finalizeUncertainty(
  analysis: PendingAnalysis,
  familyAlpha: number,
): MetricChangeAnalysis["uncertainty"] {
  if (analysis.dataQuality === "fail" || analysis.adjustedPValue === null) return "high";
  if (analysis.adjustedPValue <= familyAlpha && analysis.dataQuality === "pass") return "low";
  if (
    analysis.approximatePValue !== null &&
    (analysis.approximatePValue <= familyAlpha || analysis.adjustedPValue <= Math.min(0.1, familyAlpha * 2))
  ) return "moderate";
  return "high";
}

/**
 * Compare daily metrics before and after the latest eligible GLP-1 start/titration.
 * The event day itself is omitted to avoid mixing pre/post exposure within one day.
 */
export function analyzeMetricChanges(
  input: EngineInput,
  config: EngineConfig,
  options: MetricAnalysisOptions = {},
): MetricChangeAnalysis[] {
  const anchor = chooseAnchor(input, options.anchorEvent);
  if (!anchor) return [];
  const anchorDate = eventDate(anchor);
  const anchorOrdinal = anchorDate ? dateOrdinal(anchorDate) : null;
  if (anchorOrdinal === null) return [];

  const windowDays = Math.max(
    1,
    Math.floor(options.windowDays ?? Math.max(14, 2 * Math.max(config.baselineMinDays, config.postMinDays))),
  );
  const metricKeys = [...new Set(input.metrics.map((observation) => observation.metric))].sort();
  const pending: PendingAnalysis[] = [];

  for (const metric of metricKeys) {
    const warnings: string[] = [];
    const raw = input.metrics.filter((observation) => (
      observation.metric === metric &&
      Number.isFinite(observation.value) &&
      Number.isFinite(observation.completeness) &&
      dateOrdinal(observation.date) !== null
    ));
    const { points: collapsed, duplicateFound } = collapseDuplicateDays(raw);
    if (duplicateFound) addWarning(warnings, "DUPLICATE_DAY_OBSERVATIONS_COLLAPSED");

    const inWindow = collapsed.filter((point) => {
      const ordinal = dateOrdinal(point.date)!;
      const distance = ordinal - anchorOrdinal;
      return (distance <= -1 && distance >= -windowDays) || (distance >= 1 && distance <= windowDays);
    });
    const rejected = inWindow.filter((point) => point.completeness < config.completenessFail);
    if (rejected.length > 0) addWarning(warnings, "OBSERVATIONS_BELOW_COMPLETENESS_FAIL_EXCLUDED");
    const accepted = inWindow.filter((point) => point.completeness >= config.completenessFail);
    const baseline = accepted.filter((point) => dateOrdinal(point.date)! < anchorOrdinal);
    const post = accepted.filter((point) => dateOrdinal(point.date)! > anchorOrdinal);
    if (accepted.some((point) => point.completeness < config.completenessPass)) {
      addWarning(warnings, "LOW_COMPLETENESS_PRESENT");
    }
    if (baseline.length < config.baselineMinDays) addWarning(warnings, "INSUFFICIENT_BASELINE_DAYS");
    if (post.length < config.postMinDays) addWarning(warnings, "INSUFFICIENT_POST_DAYS");

    const devices = new Set([...baseline, ...post].map((point) => point.deviceId));
    if (devices.size > 1) addWarning(warnings, "DEVICE_CHANGED_ACROSS_WINDOWS");
    const units = new Set([...baseline, ...post].map((point) => point.unit));
    if (units.size > 1) addWarning(warnings, "UNIT_CHANGED_ACROSS_WINDOWS");

    const insufficient = baseline.length < config.baselineMinDays || post.length < config.postMinDays;
    const incomparable = devices.size > 1 || units.size > 1;
    const lowCompleteness = accepted.some((point) => point.completeness < config.completenessPass);
    const dataQuality = insufficient || incomparable ? "fail" : lowCompleteness ? "low" : "pass";

    // Empty windows are represented as null. NaN leaks through JSON as a
    // misleading null while still violating the TypeScript contract.
    const baselineValues = baseline.map((point) => point.value);
    const postValues = post.map((point) => point.value);
    const baselineMean = baselineValues.length > 0 ? mean(baselineValues) : null;
    const postMean = postValues.length > 0 ? mean(postValues) : null;
    const absoluteChange = baselineMean !== null && postMean !== null
      ? postMean - baselineMean
      : null;
    const percentChange = baselineMean !== null && baselineMean !== 0 && absoluteChange !== null
      ? absoluteChange / Math.abs(baselineMean) * 100
      : null;
    if (baselineMean === 0) addWarning(warnings, "ZERO_BASELINE_MEAN");
    const baselineSd = sampleStandardDeviation(baselineValues);
    const standardizedChange = baselineSd !== null && baselineSd > 0 && absoluteChange !== null
      ? absoluteChange / baselineSd
      : null;
    if (baselineValues.length >= 2 && baselineSd === 0) addWarning(warnings, "ZERO_BASELINE_VARIANCE");

    let ci95: [number, number] | null = null;
    let approximatePValue: number | null = null;
    if (dataQuality !== "fail" && baseline.length >= 2 && post.length >= 2) {
      const baselineVariance = hacVarianceOfMean(baselineValues, options.hacLag);
      const postVariance = hacVarianceOfMean(postValues, options.hacLag);
      if (baselineVariance !== null && postVariance !== null) {
        const standardError = Math.sqrt(baselineVariance + postVariance);
        if (standardError > 0 && absoluteChange !== null) {
          ci95 = [absoluteChange - NORMAL_95 * standardError, absoluteChange + NORMAL_95 * standardError];
          approximatePValue = twoSidedNormalP(absoluteChange / standardError);
        } else if (absoluteChange !== null && absoluteChange !== 0) {
          ci95 = [absoluteChange, absoluteChange];
          approximatePValue = Number.MIN_VALUE;
          addWarning(warnings, "ZERO_ESTIMATED_STANDARD_ERROR");
        } else {
          ci95 = [0, 0];
          approximatePValue = 1;
          addWarning(warnings, "ZERO_ESTIMATED_STANDARD_ERROR");
        }
      }
    }
    if (ci95 && ci95[0] <= 0 && ci95[1] >= 0) addWarning(warnings, "CI_INCLUDES_ZERO");

    const direction: MetricChangeAnalysis["direction"] = absoluteChange === null
      ? "unknown"
      : ci95 === null || (ci95[0] <= 0 && ci95[1] >= 0)
        ? "flat"
        : absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "flat";

    pending.push({
      metric: metric as MetricKey,
      unit: baseline[0]?.unit ?? post[0]?.unit ?? raw[0]?.unit ?? "unknown",
      baselineDays: baseline.length,
      postDays: post.length,
      baselineMean: baselineMean === null ? null : round(baselineMean),
      postMean: postMean === null ? null : round(postMean),
      absoluteChange: absoluteChange === null ? null : round(absoluteChange),
      percentChange: percentChange === null ? null : round(percentChange),
      standardizedChange: standardizedChange === null ? null : round(standardizedChange),
      magnitude: magnitudeFor(standardizedChange),
      ci95: ci95 ? [round(ci95[0]), round(ci95[1])] : null,
      approximatePValue: approximatePValue === null ? null : roundProbability(approximatePValue),
      adjustedPValue: null,
      uncertainty: "high",
      direction,
      dataQuality,
      warnings,
      rawPForAdjustment: approximatePValue,
    });
  }

  holmAdjust(pending);
  return pending.map((analysis) => {
    analysis.uncertainty = finalizeUncertainty(analysis, config.familyAlpha);
    const { rawPForAdjustment: _rawPForAdjustment, ...result } = analysis;
    return result;
  });
}
