"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useMemo, useState } from "react";

type ScenarioId = "U-01" | "U-02" | "U-03";
type Tone = "pass" | "warn" | "stop" | "muted";

const scenarios = {
  "U-01": {
    label: "상품을 비교할 수 있는 질문",
    question: "증량 뒤 식사량이 줄었어요. 우유 알레르기가 있는데 어떤 단백질 제품을 비교하면 좋을까요?",
    facts: ["성인 확인", "위험 신호 없음", "같은 기기 기록 42일", "우유 알레르기", "하루 단백질 식사 1회"],
  },
  "U-02": {
    label: "안전 확인이 먼저인 질문",
    question: "배가 심하게 계속 아프고 반복해서 토해요. 마시기 쉬운 제품을 추천해 주세요.",
    facts: ["성인 확인", "심한 지속 복통", "반복 구토", "수분 섭취 어려움", "상품 요청 포함"],
  },
  "U-03": {
    label: "기록이 부족한 질문",
    question: "근손실이 걱정돼요. 새 워치를 산 지 5일 됐는데 변화와 제품을 같이 봐 주세요.",
    facts: ["성인 확인", "위험 신호 없음", "새 기기 기록 5일", "이전 기기와 비교 불가", "하루 단백질 식사 3회"],
  },
} as const;

const judgmentCards = [
  { q: "정말 달라졌나?", code: "변화", desc: "평소의 나와 지금을 비교합니다. 변화량만이 아니라 오차 범위와 기록 품질을 함께 봅니다." },
  { q: "약 사건과 시점이 겹치나?", code: "관련 시점", desc: "시작·증량 시점과 변화가 겹치는지만 말합니다. ‘약 때문’이라고 원인을 확정하지 않습니다." },
  { q: "지금 먼저 확인할 위험이 있나?", code: "안전", desc: "심한 복통·반복 구토·수분 섭취 곤란 같은 신호가 있으면 상품 흐름을 즉시 멈춥니다." },
  { q: "비슷한 사람과 비교해도 되나?", code: "집단 비교", desc: "동의, 충분한 표본, 편향 검토가 모두 있을 때만 비교 위치를 표시합니다." },
  { q: "변화가 멈춘 상태인가?", code: "정체", desc: "충분히 긴 추세와 생활 맥락이 있을 때만 정체 후보를 계산합니다. 약 조정 결론은 내리지 않습니다." },
  { q: "이 사람에게 효과가 있었나?", code: "개인 효과", desc: "승인된 n-of-1 설계와 순응도 자료가 없으면 효과를 주장하지 않습니다." },
];

const auditRows = [
  { label: "안전 우선순위", before: 58, after: 92, note: "위험 신호가 약 변경 경계보다 항상 먼저 작동" },
  { label: "변화·불확실성", before: 76, after: 87, note: "같은 기기, 결측, 자기상관, 다중 비교를 함께 처리" },
  { label: "상품 적격성", before: 61, after: 86, note: "질문 목적에 맞는 카테고리 검색 후 hard filter" },
  { label: "개인정보·동의", before: 67, after: 91, note: "브랜드 집계 동의가 없으면 이벤트를 내보내지 않음" },
  { label: "재현·관측 가능성", before: 49, after: 84, note: "순서가 있는 시각·버전·사유 코드로 한 결정을 재현" },
  { label: "운영 준비도", before: 44, after: 70, note: "테스트는 강화했지만 의료 검증·실데이터 보정은 아직 필요" },
];

const hardFilters = [
  ["질문 목적 불일치", "관련 상품을 찾는 단계에서 제외", "예: 수면 질문에 단백질 상품을 넣지 않음"],
  ["알레르기 일치", "무조건 제외", "점수가 아무리 높아도 다시 들어오지 않음"],
  ["금기·의료진 제한", "제외 또는 전문가 검토", "자동 순위 계산 전에 처리"],
  ["상호작용 미확인", "전문가 검토", "사용자에게 자동 노출하지 않음"],
  ["라벨·근거 없음", "제외", "브랜드가 정보를 보완하면 재평가 가능"],
  ["가격·재고 오래됨", "제외", "확인 시각과 허용 기한을 함께 기록"],
];

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: digits }).format(value);
}

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`guide-status ${tone}`}>{children}</span>;
}

export default function EngineGuideApp() {
  const [scenario, setScenario] = useState<ScenarioId>("U-01");
  const [baselineDays, setBaselineDays] = useState(42);
  const [milkAllergy, setMilkAllergy] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [observedChange, setObservedChange] = useState(6);
  const [dailyNoise, setDailyNoise] = useState(5);
  const [correctionOn, setCorrectionOn] = useState(true);

  const isSafetyStop = scenario === "U-02";
  const hasEnoughData = scenario !== "U-03" && baselineDays >= 28;
  const outcome = isSafetyStop
    ? { title: "상품을 보여주지 않음", desc: "안전 안내 후 의료 확인으로 연결", tone: "stop" as Tone }
    : !hasEnoughData
      ? { title: "기록 부족으로 판단 보류", desc: "같은 기기 기록을 더 모은 뒤 다시 계산", tone: "warn" as Tone }
      : { title: "조건을 통과한 상품 2개 비교", desc: "음식 우선 안내와 함께 근거·가격을 표시", tone: "pass" as Tone };

  const pipeline = useMemo(() => {
    const retrieved = isSafetyStop || !hasEnoughData ? 0 : 5;
    const filtered = retrieved === 0 ? 0 : milkAllergy ? 2 : 1;
    const review = retrieved === 0 ? 0 : 1;
    const eligible = Math.max(0, retrieved - filtered - review);
    return [
      { title: "질문 구조화", value: "질문 목적 3개", detail: "원문은 대화 안에 두고 분석에는 통제된 코드만 사용합니다.", tone: "pass" as Tone },
      { title: "안전 관문", value: isSafetyStop ? "위험 신호 있음" : "통과", detail: isSafetyStop ? "여기서 상품 검색과 점수 계산을 모두 멈춥니다." : "위험 신호를 실제로 확인했다는 기록이 있어야 통과합니다.", tone: isSafetyStop ? "stop" as Tone : "pass" as Tone },
      { title: "기록 품질", value: `${scenario === "U-03" ? 5 : baselineDays}일`, detail: hasEnoughData ? "같은 기기와 단위, 충분한 기록 비율을 확인했습니다." : "새 기기 또는 짧은 기준선은 변화 계산에 쓰지 않습니다.", tone: isSafetyStop ? "muted" as Tone : hasEnoughData ? "pass" as Tone : "warn" as Tone },
      { title: "6가지 판단", value: isSafetyStop ? "안전만 실행" : hasEnoughData ? "3개 열림 · 3개 보류" : "변화 판단 보류", detail: "말할 수 있는 범위와 아직 말할 수 없는 범위를 분리합니다.", tone: isSafetyStop ? "muted" as Tone : hasEnoughData ? "pass" as Tone : "warn" as Tone },
      { title: "관련 상품 찾기", value: retrieved ? `${retrieved}개` : "실행 안 함", detail: "질문 목적과 연결된 카테고리만 가져옵니다.", tone: retrieved ? "pass" as Tone : "muted" as Tone },
      { title: "필수 조건 검사", value: retrieved ? `${filtered}개 제외 · ${review}개 검토` : "실행 안 함", detail: "알레르기·금기·라벨·근거는 점수보다 먼저 적용합니다.", tone: retrieved ? "warn" as Tone : "muted" as Tone },
      { title: "적격 상품 순서", value: eligible ? `${eligible}개 점수 계산` : "실행 안 함", detail: "광고비나 클릭률은 점수에 넣지 않습니다.", tone: eligible ? "pass" as Tone : "muted" as Tone },
      { title: "최종 답변", value: outcome.title, detail: outcome.desc, tone: outcome.tone },
    ];
  }, [baselineDays, hasEnoughData, isSafetyStop, milkAllergy, outcome.desc, outcome.title, outcome.tone, scenario]);

  const se = dailyNoise * Math.sqrt(2 / Math.max(4, Math.min(42, baselineDays)));
  const margin = 1.96 * se;
  const low = observedChange - margin;
  const high = observedChange + margin;
  const clearChange = low > 0 || high < 0;

  return (
    <main className="engine-guide">
      <header className="guide-topbar">
        <a className="guide-brand" href="/" aria-label="Lumen 분석 도구로 이동">
          <span className="guide-logo">L</span>
          <span>Lumen</span>
        </a>
        <nav aria-label="페이지 이동">
          <a href="/">브랜드 분석</a>
          <a className="active" href="/engine-guide">추천 엔진 이해하기</a>
        </nav>
        <span className="synthetic-badge">합성 예시 · 의료기기 아님</span>
      </header>

      <section className="guide-hero">
        <div className="guide-kicker">ENGINE, EXPLAINED</div>
        <h1>질문을 받으면 바로 상품을 고르지 않습니다.</h1>
        <p>
          이 엔진의 첫 번째 일은 “무엇을 추천할까?”가 아니라 <strong>지금 무엇을 말해도 되는가</strong>를 정하는 것입니다.
          위험 신호, 기록 품질, 통계적 불확실성, 상품의 필수 조건을 차례로 통과한 경우에만 비교 화면이 열립니다.
        </p>
        <div className="guide-hero-summary">
          <div><strong>6</strong><span>서로 다른 판단 질문</span></div>
          <div><strong>우선</strong><span>상품보다 안전 확인</span></div>
          <div><strong>0</strong><span>광고비가 순위에 미치는 영향</span></div>
          <div><strong>재현</strong><span>버전·시각·결정 이유 기록</span></div>
        </div>
      </section>

      <section className="guide-section guide-live" id="example">
        <div className="guide-section-heading">
          <div>
            <span className="section-number">01</span>
            <h2>질문 한 개를 끝까지 따라가 보기</h2>
            <p>예시를 바꾸면 엔진이 어디에서 멈추고 무엇을 계산하는지가 함께 바뀝니다.</p>
          </div>
          <StatusPill tone={outcome.tone}>{outcome.title}</StatusPill>
        </div>

        <div className="scenario-tabs" role="tablist" aria-label="엔진 실행 예시">
          {(Object.keys(scenarios) as ScenarioId[]).map((id) => (
            <button
              key={id}
              className={scenario === id ? "active" : ""}
              onClick={() => {
                setScenario(id);
                setBaselineDays(id === "U-03" ? 5 : 42);
                setActiveStep(0);
              }}
              role="tab"
              aria-selected={scenario === id}
            >
              <span>{id}</span>
              {scenarios[id].label}
            </button>
          ))}
        </div>

        <div className="scenario-layout">
          <aside className="scenario-input-card">
            <div className="card-label">사용자가 물은 내용</div>
            <blockquote>“{scenarios[scenario].question}”</blockquote>
            <div className="known-facts">
              <span>확인된 정보</span>
              <ul>
                {scenarios[scenario].facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            </div>
            {scenario === "U-01" && (
              <div className="scenario-controls">
                <label>
                  <span>같은 기기 기준선 <b>{baselineDays}일</b></span>
                  <input type="range" min="5" max="42" value={baselineDays} onChange={(event) => setBaselineDays(Number(event.target.value))} />
                </label>
                <button className={`toggle-row ${milkAllergy ? "on" : ""}`} onClick={() => setMilkAllergy((value) => !value)} aria-pressed={milkAllergy}>
                  <span><b>우유 알레르기</b><small>켜면 유청 상품이 점수 전에 제외됩니다.</small></span>
                  <i aria-hidden="true" />
                </button>
              </div>
            )}
          </aside>

          <div className="pipeline-card">
            <div className="pipeline-track" aria-label="엔진 처리 단계">
              {pipeline.map((step, index) => (
                <button key={step.title} className={`pipeline-node ${step.tone} ${activeStep === index ? "active" : ""}`} onClick={() => setActiveStep(index)}>
                  <span className="node-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="node-copy"><b>{step.title}</b><small>{step.value}</small></span>
                  {index < pipeline.length - 1 && <i className="node-line" aria-hidden="true" />}
                </button>
              ))}
            </div>
            <div className={`pipeline-inspector ${pipeline[activeStep].tone}`}>
              <div>
                <span>{String(activeStep + 1).padStart(2, "0")} · {pipeline[activeStep].title}</span>
                <h3>{pipeline[activeStep].value}</h3>
              </div>
              <p>{pipeline[activeStep].detail}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="guide-section judgment-section">
        <div className="guide-section-heading">
          <div>
            <span className="section-number">02</span>
            <h2>‘판단 6가지’는 같은 말을 여섯 번 하는 게 아닙니다</h2>
            <p>각 질문은 요구하는 자료와 허용되는 결론이 다릅니다. 하나를 통과해도 다른 결론까지 자동으로 따라오지 않습니다.</p>
          </div>
        </div>
        <div className="judgment-grid">
          {judgmentCards.map((item, index) => (
            <article key={item.code}>
              <div className="judgment-head"><span>{index + 1}</span><em>{item.code}</em></div>
              <h3>{item.q}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-section stats-section">
        <div className="guide-section-heading">
          <div>
            <span className="section-number">03</span>
            <h2>“6만큼 변했다”만으로는 부족합니다</h2>
            <p>변화 크기가 평소 흔들림보다 충분히 큰지, 기록이 서로 비교 가능한지, 여러 지표를 동시에 보며 우연히 잡힌 것은 아닌지 확인합니다.</p>
          </div>
        </div>
        <div className="stats-lab">
          <div className="stats-controls">
            <label>
              <span>관찰된 평균 변화 <b>{observedChange > 0 ? "+" : ""}{observedChange}</b></span>
              <input type="range" min="-10" max="12" value={observedChange} onChange={(event) => setObservedChange(Number(event.target.value))} />
            </label>
            <label>
              <span>평소 하루 흔들림 <b>{dailyNoise}</b></span>
              <input type="range" min="1" max="12" value={dailyNoise} onChange={(event) => setDailyNoise(Number(event.target.value))} />
            </label>
            <label>
              <span>비교 가능한 날짜 <b>{baselineDays}일</b></span>
              <input type="range" min="5" max="42" value={baselineDays} onChange={(event) => setBaselineDays(Number(event.target.value))} />
            </label>
          </div>
          <div className="interval-viz">
            <div className="interval-title">
              <span>추정 변화와 95% 범위</span>
              <StatusPill tone={baselineDays < 14 ? "warn" : clearChange ? "pass" : "muted"}>
                {baselineDays < 14 ? "기록 부족" : clearChange ? "방향이 비교적 분명" : "0을 포함해 불확실"}
              </StatusPill>
            </div>
            <div className="number-line" aria-label={`95% 범위 ${low.toFixed(1)}에서 ${high.toFixed(1)}`}>
              <div className="axis-zero" />
              <div className="confidence-band" style={{ left: `${Math.max(1, 50 + low * 3)}%`, width: `${Math.max(2, Math.min(98, (high - low) * 3))}%` }} />
              <div className="point-estimate" style={{ left: `${Math.max(1, Math.min(99, 50 + observedChange * 3))}%` }} />
            </div>
            <div className="interval-values">
              <span>하한 {formatNumber(low)}</span><strong>{observedChange > 0 ? "+" : ""}{formatNumber(observedChange)}</strong><span>상한 {formatNumber(high)}</span>
            </div>
            <p>
              {baselineDays < 14
                ? "날짜 수가 너무 적어 결과를 열지 않습니다. 숫자가 커 보여도 판단은 보류합니다."
                : clearChange
                  ? "범위가 0을 지나지 않습니다. 그래도 이것은 ‘변화 관찰’이지 원인 확정이나 진단이 아닙니다."
                  : "가능한 범위에 0이 들어갑니다. 방향을 확정하지 않고 기록을 더 모으도록 안내합니다."}
            </p>
          </div>
        </div>

        <div className="false-alarm-card">
          <div className="false-alarm-copy">
            <span className="card-label">아무 일도 없는데 경보가 울리는 비율</span>
            <h3>지표를 여러 번 들여다보면 우연한 신호가 늘어납니다.</h3>
            <p>아래 100칸은 실제 변화가 없는 실험 100회를 뜻합니다. 보정은 “우연히 한 번 튄 값”을 변화로 오해하지 않도록 판단 문턱을 조절합니다.</p>
            <button className={`toggle-row compact ${correctionOn ? "on" : ""}`} onClick={() => setCorrectionOn((value) => !value)} aria-pressed={correctionOn}>
              <span><b>여러 지표·반복 확인 보정</b><small>{correctionOn ? "적용 중" : "꺼짐 — 설명용"}</small></span>
              <i aria-hidden="true" />
            </button>
          </div>
          <div className="false-alarm-viz">
            <div className="dot-grid" aria-label={`거짓 경보 ${correctionOn ? 5 : 28}개`}>
              {Array.from({ length: 100 }, (_, index) => <span key={index} className={index < (correctionOn ? 5 : 28) ? "alert" : ""} />)}
            </div>
            <strong>{correctionOn ? "약 5회" : "약 28회"}<small>/ 변화 없는 100회</small></strong>
            <p>개념 예시입니다. 실제 비율은 데이터의 자기상관·결측·지표 수와 검증 표본에 따라 다시 보정해야 합니다.</p>
          </div>
        </div>
      </section>

      <section className="guide-section filter-section">
        <div className="guide-section-heading">
          <div>
            <span className="section-number">04</span>
            <h2>필수 조건은 점수보다 먼저 작동합니다</h2>
            <p>점수가 높은 상품이 위험 조건을 덮는 일이 없도록, 제외·검토 조건을 통과한 상품만 순위를 계산합니다.</p>
          </div>
        </div>
        <div className="filter-flow">
          <div className="filter-source"><b>관련 상품 5개</b><span>질문 목적과 카테고리 일치</span></div>
          <div className="filter-gate">
            <span>필수 조건 검사</span>
            <b>알레르기 · 금기 · 상호작용<br />라벨 · 근거 · 최신성</b>
          </div>
          <div className="filter-outcomes">
            <div className="pass"><b>2개</b><span>적격 — 점수 계산</span></div>
            <div className="warn"><b>1개</b><span>전문가 검토</span></div>
            <div className="stop"><b>2개</b><span>제외 — 사용자에게 미노출</span></div>
          </div>
        </div>
        <div className="filter-table-wrap">
          <table className="guide-table">
            <thead><tr><th>확인 항목</th><th>엔진의 처리</th><th>뜻</th></tr></thead>
            <tbody>{hardFilters.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="guide-section audit-section">
        <div className="guide-section-heading">
          <div>
            <span className="section-number">05</span>
            <h2>비판적으로 다시 채점한 결과</h2>
            <p>점수는 의료적 유효성 인증이 아니라, 코드·테스트·데이터 계약을 대상으로 한 내부 설계 감사 점수입니다.</p>
          </div>
          <div className="audit-summary"><span>설계 감사</span><strong>56 → 82</strong><small>100점 기준 · 운영 전 보수적 평가</small></div>
        </div>
        <div className="audit-grid">
          {auditRows.map((row) => (
            <article key={row.label}>
              <div className="audit-label"><b>{row.label}</b><span>{row.before} → <strong>{row.after}</strong></span></div>
              <div className="audit-track"><i className="before" style={{ width: `${row.before}%` }} /><i className="after" style={{ width: `${row.after}%` }} /></div>
              <p>{row.note}</p>
            </article>
          ))}
        </div>
        <div className="remaining-limits">
          <h3>아직 ‘완성’이라고 부르면 안 되는 이유</h3>
          <div>
            <p><b>의료적 검증 전</b><span>실제 사용자와 독립 임상 검토를 거친 알고리즘이 아닙니다.</span></p>
            <p><b>실데이터 보정 전</b><span>경보 문턱과 상품 점수 가중치는 운영 자료로 재보정해야 합니다.</span></p>
            <p><b>코호트·정체·개인효과 제한</b><span>입력 계약은 열어 두되 검증 자료가 없으면 결과를 닫는 것이 맞습니다.</span></p>
          </div>
        </div>
      </section>

      <section className="guide-section privacy-section">
        <div className="privacy-diagram">
          <div>
            <span>대화 안에 남음</span>
            <h3>질문 원문 · 약명 · 용량<br />개인 건강 원시값</h3>
            <p>서비스 판단에 필요하지만 브랜드 분석에는 전달하지 않습니다.</p>
          </div>
          <i aria-hidden="true">→</i>
          <div>
            <span>브랜드 화면에 허용</span>
            <h3>질문 목적 코드 · 답변 유형<br />상품 ID · 제외 이유 · 버전</h3>
            <p>집계 동의가 있고 최소 인원 기준을 넘은 경우에만 분석합니다.</p>
          </div>
        </div>
      </section>

      <footer className="guide-footer">
        <div><strong>숫자가 나온 경로까지 확인해 보세요.</strong><span>브랜드 분석 도구에서 질문→상품 퍼널과 익명 처리 기록을 직접 탐색할 수 있습니다.</span></div>
        <a href="/">브랜드 분석 열기 <span>→</span></a>
      </footer>
    </main>
  );
}
