import type { BrandAnalyticsAggregate } from "./analytics.ts";
import type { EngineDecision, ProductCandidate } from "./types.ts";

const stageLabels: Record<string, string> = {
  question_asked: "질문 입력",
  intent_classified: "의도 분류",
  clarification_completed: "필수 정보 완료",
  safety_passed: "안전 조건 통과",
  candidate_generated: "상품 후보 생성",
  recommendation_impression: "적격 상품 노출",
  evidence_opened: "근거 열람",
  product_clicked: "상품 클릭"
};

const verdictLabels: Record<string, string> = {
  show_eligible_products: "적격 상품 비교",
  safety_stop: "안전 경로 전환",
  insufficient_data: "데이터 부족 보류",
  recommend_food_first: "음식 우선",
  medication_boundary: "처방 경계",
  ask_clarification: "추가 질문",
  clinical_consult: "전문가 검토",
  abstain: "추천 보류"
};

const reasonLabels: Record<string, string> = {
  ALLERGEN_MATCH: "알레르기 일치",
  ALLERGEN_DECLARATION_MISSING: "알레르기 표시 미확인",
  CLINICIAN_REVIEW_REQUIRED: "의료진 검토 필요",
  INTERACTION_UNVERIFIED: "상호작용 미검증",
  LABEL_MISSING: "라벨 출처 누락",
  EVIDENCE_MISSING: "근거 누락",
  PRODUCT_DATA_STALE: "가격·재고 정보 오래됨",
  STOCK_UNKNOWN: "재고 미확인",
  PRICE_MISSING: "가격 누락",
  DATA_FRESHNESS_MISSING: "확인 시점 누락"
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countFor(aggregate: BrandAnalyticsAggregate, stage: string): number {
  return aggregate.funnel.find((item) => item.stage === stage)?.count ?? 0;
}

function percent(count: number, denominator: number | null): number {
  if (denominator === null) return count > 0 ? 100 : 0;
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(100, count / denominator * 100));
}

export function renderBrandDashboard(
  aggregate: BrandAnalyticsAggregate,
  decisions: EngineDecision[],
  catalog: ProductCandidate[]
): string {
  const productNames = new Map(catalog.map((product) => [product.productId, product.name]));
  const maxReasonCount = Math.max(1, ...aggregate.exclusions.map((item) => item.count));
  const funnelRows = aggregate.funnel.map((item) => {
    const value = percent(item.count, item.denominator);
    const denominator = item.denominator === null ? "시작" : `${item.count}/${item.denominator}`;
    return `<div class="funnel-row">
      <div><strong>${escapeHtml(stageLabels[item.stage] ?? item.stage)}</strong><span>${denominator}</span></div>
      <div class="track"><i style="width:${value.toFixed(1)}%"></i></div>
      <b>${item.count}</b>
    </div>`;
  }).join("");

  const verdictCards = aggregate.verdicts.map((item) => `<div class="verdict-card">
    <span>${escapeHtml(verdictLabels[item.code] ?? item.code)}</span><strong>${item.count}</strong>
  </div>`).join("");

  const reasonRows = aggregate.exclusions.map((item) => `<div class="reason-row">
    <span>${escapeHtml(reasonLabels[item.reasonCode] ?? item.reasonCode)}</span>
    <div><i style="width:${(item.count / maxReasonCount * 100).toFixed(1)}%"></i></div>
    <b>${item.count}</b>
  </div>`).join("") || `<p class="empty">아직 상품 탈락 이벤트가 없습니다.</p>`;

  const productRows = aggregate.productGaps.map((item) => {
    const reasons = item.topReasons.map((reason) => `<span class="reason-pill">${escapeHtml(reasonLabels[reason.reasonCode] ?? reason.reasonCode)} · ${reason.count}</span>`).join("");
    const gaps = item.dataGapReasons.map((reason) => escapeHtml(reasonLabels[reason.reasonCode] ?? reason.reasonCode)).join(", ");
    const action = gaps.length > 0 ? gaps : item.excludedCount > 0 ? "사용자 조건 — 브랜드 수정 대상 아님" : "현재 보완 과제 없음";
    return `<tr>
      <th><small>${escapeHtml(item.productId)}</small>${escapeHtml(productNames.get(item.productId) ?? item.productId)}</th>
      <td>${item.candidateCount}</td><td>${item.eligibleCount}</td><td>${item.excludedCount}</td>
      <td><div class="pill-wrap">${reasons || "—"}</div></td>
      <td class="action-cell">${escapeHtml(action)}</td>
    </tr>`;
  }).join("");

  const decisionRows = decisions.map((decision) => {
    const change = decision.judgments.find((item) => item.kind === "change");
    const risk = decision.judgments.find((item) => item.kind === "risk");
    return `<div class="decision-row">
      <span>${escapeHtml(decision.requestId)}</span>
      <strong>${escapeHtml(verdictLabels[decision.disposition] ?? decision.disposition)}</strong>
      <p>변화: ${escapeHtml(change?.status ?? "unknown")} · 안전: ${escapeHtml(risk?.status ?? "unknown")} · 적격 ${decision.eligible.length}개</p>
    </div>`;
  }).join("");

  const generated = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(aggregate.generatedAt));
  const questions = countFor(aggregate, "question_asked");
  const safetyPassed = countFor(aggregate, "safety_passed");
  const impressions = countFor(aggregate, "recommendation_impression");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>브랜드 판단 인텔리전스 · 합성 데모</title>
  <style>
    :root{--ink:#14251d;--muted:#5d6e65;--paper:#f2efe5;--white:#fffdf8;--green:#164f3a;--green2:#2f7458;--lime:#bbd27e;--red:#a8463a;--redp:#f2ded8;--blue:#356178;--line:rgba(20,37,29,.15)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,Pretendard,"Noto Sans KR",sans-serif;line-height:1.55;word-break:keep-all}
    header{background:var(--green);color:white;padding:48px max(24px,calc((100vw - 1180px)/2));border-bottom:7px solid var(--lime)}
    header nav{display:flex;justify-content:space-between;align-items:center;gap:20px}header nav strong{font-size:.76rem;letter-spacing:.12em}header nav span{font-size:.72rem;color:var(--lime);border:1px solid rgba(255,255,255,.3);padding:5px 9px}
    header h1{font-size:clamp(2.2rem,5vw,4.7rem);line-height:1.02;letter-spacing:-.055em;max-width:920px;margin:54px 0 22px}header p{max-width:760px;color:#d8e3db;margin:0;font-size:1rem}
    main{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:56px 0 90px}.section{margin-top:62px}.section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:20px}.section-head h2{font-size:1.65rem;letter-spacing:-.03em;margin:0}.section-head p{color:var(--muted);margin:0;font-size:.78rem}
    .metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{background:var(--white);padding:24px;border-top:4px solid var(--green2)}.metric span{display:block;color:var(--muted);font-size:.72rem}.metric strong{display:block;font-size:2rem;font-family:ui-monospace,monospace;margin:6px 0}.metric small{color:var(--green2)}
    .two-col{display:grid;grid-template-columns:1.08fr .92fr;gap:16px}.panel{background:var(--white);padding:28px}.funnel-row{display:grid;grid-template-columns:170px 1fr 28px;gap:14px;align-items:center;margin:16px 0}.funnel-row>div:first-child strong,.funnel-row>div:first-child span{display:block}.funnel-row>div:first-child strong{font-size:.8rem}.funnel-row>div:first-child span{color:var(--muted);font-size:.67rem}.track,.reason-row>div{height:18px;background:#e6e3d9}.track i,.reason-row i{display:block;height:100%;background:var(--green2)}.funnel-row b,.reason-row b{font-family:ui-monospace,monospace}
    .verdict-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.verdict-card{padding:18px;background:#e5eee7}.verdict-card span{display:block;color:var(--muted);font-size:.72rem}.verdict-card strong{font-size:1.65rem;font-family:ui-monospace,monospace}.reason-row{display:grid;grid-template-columns:170px 1fr 28px;gap:12px;align-items:center;margin:15px 0;font-size:.75rem}.reason-row i{background:var(--red)}
    .table-wrap{overflow:auto;background:var(--white)}table{width:100%;border-collapse:collapse;min-width:940px;font-size:.76rem}th,td{text-align:left;vertical-align:top;padding:15px 13px;border-bottom:1px solid var(--line)}thead th{background:var(--green);color:white;font-size:.66rem}tbody th{min-width:180px}tbody th small{display:block;color:var(--green2);font-family:ui-monospace,monospace}.pill-wrap{display:flex;flex-wrap:wrap;gap:5px}.reason-pill{background:var(--redp);color:var(--red);padding:3px 6px;font-size:.65rem}.action-cell{color:var(--muted);min-width:190px}
    .decision-list{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.decision-row{background:var(--white);padding:22px;border-left:4px solid var(--green2)}.decision-row>span{color:var(--green2);font-family:ui-monospace,monospace;font-size:.7rem}.decision-row strong{display:block;margin:7px 0}.decision-row p{margin:0;color:var(--muted);font-size:.74rem}
    .boundary{display:grid;grid-template-columns:1fr 1fr;gap:16px}.boundary>div{padding:26px;background:#e0ece3}.boundary>div:last-child{background:var(--redp)}.boundary strong{display:block}.boundary ul{padding-left:18px;margin-bottom:0;color:var(--muted);font-size:.8rem}.empty{color:var(--muted);font-size:.8rem}
    footer{background:#102d23;color:white;padding:28px max(24px,calc((100vw - 1180px)/2));font-size:.72rem;display:flex;justify-content:space-between;gap:20px}footer span{color:#b6c6bb}
    @media(max-width:850px){.metric-grid,.two-col,.decision-list,.boundary{grid-template-columns:1fr 1fr}.funnel-row,.reason-row{grid-template-columns:140px 1fr 24px}}
    @media(max-width:620px){.metric-grid,.two-col,.decision-list,.boundary{grid-template-columns:1fr}header{padding-top:30px}.panel{padding:20px}.section-head{display:block}.section-head p{margin-top:8px}}
  </style>
</head>
<body>
  <header>
    <nav><strong>BRAND DECISION INTELLIGENCE</strong><span>합성 데모 · 실제 성과 아님</span></nav>
    <h1>사용자가 아니라<br />브랜드가 고칠 일을 봅니다.</h1>
    <p>질문 원문과 개인 건강정보 없이, 판단 엔진이 남긴 통제된 코드만으로 추천 퍼널·상품 탈락·정보 결측을 확인합니다.</p>
  </header>
  <main>
    <section class="metric-grid" aria-label="핵심 지표">
      <div class="metric"><span>질문 세션</span><strong>${questions}</strong><small>합성 시나리오</small></div>
      <div class="metric"><span>안전 조건 통과</span><strong>${safetyPassed}/${questions}</strong><small>안전 전환은 실패 KPI가 아님</small></div>
      <div class="metric"><span>적격 상품 노출</span><strong>${impressions}</strong><small>Hard filter 통과 뒤</small></div>
      <div class="metric"><span>수정 가능한 결측</span><strong>${aggregate.dataGaps.reduce((sum,item)=>sum+item.count,0)}</strong><small>라벨·근거·가격·재고</small></div>
    </section>

    <section class="section two-col">
      <div class="panel"><div class="section-head"><h2>질문→판정→추천 퍼널</h2><p>분자 / 직전 단계 분모</p></div>${funnelRows}</div>
      <div class="panel"><div class="section-head"><h2>판정과 탈락 이유</h2><p>낮춰야 할 이탈과 안전 보류를 분리</p></div><div class="verdict-grid">${verdictCards}</div><div style="height:18px"></div>${reasonRows}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>상품 노출·탈락·정보 결측</h2><p>사용자 조건과 브랜드가 수정할 수 있는 문제를 구분</p></div>
      <div class="table-wrap"><table><thead><tr><th>상품</th><th>후보</th><th>적격</th><th>제외</th><th>이유</th><th>브랜드 작업</th></tr></thead><tbody>${productRows}</tbody></table></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>합성 시나리오 판정</h2><p>원문 대신 scenario ID와 상태 코드만 표시</p></div>
      <div class="decision-list">${decisionRows}</div>
    </section>

    <section class="section boundary">
      <div><strong>이 화면에 들어오는 데이터</strong><ul><li>검수된 intent taxonomy</li><li>추천·보류·안전 전환 상태</li><li>상품 후보·적격·탈락 reason code</li><li>라벨·근거·가격·재고 결측</li></ul></div>
      <div><strong>이 화면에서 차단하는 데이터</strong><ul><li>질문·증상 자유서술 원문</li><li>약명·용량·개인 생체값</li><li>실명·연락처·원래 사용자 ID</li><li>행 수준 건강 타임라인</li></ul></div>
    </section>
  </main>
  <footer><strong>ENGINE ${escapeHtml(decisions[0]?.versions.engine ?? "unknown")}</strong><span>${escapeHtml(generated)} · 합성 이벤트 ${aggregate.sourceEventCount}건</span></footer>
</body>
</html>`;
}
