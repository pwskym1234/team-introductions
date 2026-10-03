"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
// vinext SSR 번들러가 이 파일의 named `useState` import 를 재작성하지 못해
// 서버 렌더에서 ReferenceError 가 났다. 네임스페이스 호출로 우회한다.

export type MenuOption = {
  value: string;
  label: string;
  description?: string;
  meta?: string;
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5v10h13v-10M9 19.5v-6h6v6"/></>,
    chart: <><path d="M4 19V9m5 10V5m6 14v-7m5 7V3"/><path d="M2.5 19.5h19"/></>,
    funnel: <><path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z"/></>,
    journey: <><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6.5 7.5l4.3 8.7M17.5 7.5l-4.3 8.7"/></>,
    users: <><path d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="7.5" r="3.5"/><path d="M17 11a3 3 0 1 0 0-6M19 15a3.5 3.5 0 0 1 2 3.2V20"/></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7v10l8 4 8-4V7M12 11v10"/></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></>,
    bulb: <><path d="M9 18h6M10 22h4"/><path d="M8.5 15.5C6.9 14.4 6 12.6 6 10.5a6 6 0 1 1 12 0c0 2.1-.9 3.9-2.5 5-.8.6-1.1 1.2-1.1 2h-4.8c0-.8-.3-1.4-1.1-2Z"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    engine: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.9 4.9 7 7m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    filter: <><path d="M3 5h18M6 12h12M10 19h4"/></>,
    chevron: <path d="m8 10 4 4 4-4"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
    save: <><path d="M5 3h12l2 2v16H5V3Z"/><path d="M8 3v6h8V3M8 21v-8h8v8"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 21h14"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    spark: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
    external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.info}</svg>;
}

export function ChoiceMenu({
  id,
  label,
  value,
  options,
  openMenu,
  setOpenMenu,
  onChange,
  icon,
  align = "left",
}: {
  id: string;
  label?: string;
  value: string;
  options: MenuOption[];
  openMenu: string | null;
  setOpenMenu: (value: string | null) => void;
  onChange: (value: string) => void;
  icon?: string;
  align?: "left" | "right";
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const isOpen = openMenu === id;

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen, setOpenMenu]);

  return (
    <div className="choice-menu" ref={rootRef}>
      {label && <span className="control-label">{label}</span>}
      <button className={`control-button ${isOpen ? "active" : ""}`} onClick={() => setOpenMenu(isOpen ? null : id)} aria-haspopup="listbox" aria-expanded={isOpen}>
        {icon && <Icon name={icon} size={16} />}
        <span>{selected?.label}</span>
        <Icon name="chevron" size={15} />
      </button>
      {isOpen && (
        <div className={`choice-popover ${align}`} role="listbox" aria-label={label ?? id}>
          {options.map((option) => (
            <button key={option.value} className={option.value === value ? "selected" : ""} onClick={() => { onChange(option.value); setOpenMenu(null); }} role="option" aria-selected={option.value === value}>
              <span className="option-check">{option.value === value && <Icon name="check" size={14} />}</span>
              <span className="option-copy"><b>{option.label}</b>{option.description && <small>{option.description}</small>}</span>
              {option.meta && <em>{option.meta}</em>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type DateRangeValue = {
  preset: string;
  start: string;
  end: string;
  compare: "none" | "previous" | "year";
};

const datePresets = [
  { id: "today", label: "오늘", days: 1 },
  { id: "yesterday", label: "어제", days: 1 },
  { id: "7d", label: "최근 7일", days: 7 },
  { id: "14d", label: "최근 14일", days: 14 },
  { id: "30d", label: "최근 30일", days: 30 },
  { id: "60d", label: "최근 60일", days: 60 },
  { id: "90d", label: "최근 90일", days: 90 },
  { id: "month", label: "이번 달", days: 0 },
  { id: "previous-month", label: "지난달", days: 0 },
  { id: "custom", label: "직접 설정", days: -1 },
];

function dateLabel(value: DateRangeValue) {
  const preset = datePresets.find((item) => item.id === value.preset);
  if (value.preset === "custom") return `${value.start.replaceAll("-", ".")}–${value.end.slice(5).replaceAll("-", ".")}`;
  return preset?.label ?? "기간 선택";
}

export function DateRangeControl({ value, onChange, openMenu, setOpenMenu }: { value: DateRangeValue; onChange: (value: DateRangeValue) => void; openMenu: string | null; setOpenMenu: (value: string | null) => void }) {
  const id = "global-date-range";
  const isOpen = openMenu === id;
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = React.useState(value);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen, setOpenMenu]);

  const pickPreset = (preset: string, days: number) => {
    const end = new Date("2026-10-03T12:00:00+09:00");
    const start = new Date(end);
    if (preset === "today") {
      // Keep today's fixed demo date as-is.
    } else if (preset === "yesterday") {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (preset === "month") {
      start.setDate(1);
    } else if (preset === "previous-month") {
      start.setMonth(start.getMonth() - 1, 1);
      end.setDate(0);
    } else {
      start.setDate(start.getDate() - days + 1);
    }
    setDraft({ ...draft, preset, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
  };

  return (
    <div className="date-control" ref={rootRef}>
      <button className={`control-button date-trigger ${isOpen ? "active" : ""}`} onClick={() => { if (!isOpen) setDraft(value); setOpenMenu(isOpen ? null : id); }} aria-expanded={isOpen}>
        <Icon name="calendar" size={16} />
        <span>{dateLabel(value)}</span>
        {value.compare !== "none" && <em>비교</em>}
        <Icon name="chevron" size={15} />
      </button>
      {isOpen && (
        <div className="date-popover">
          <div className="date-popover-head"><div><b>분석 기간</b><span>Asia/Seoul 기준</span></div><button onClick={() => setOpenMenu(null)} aria-label="기간 설정 닫기"><Icon name="close" size={17} /></button></div>
          <div className="date-preset-grid">
            {datePresets.filter((item) => item.id !== "custom").map((item) => <button key={item.id} className={draft.preset === item.id ? "active" : ""} onClick={() => pickPreset(item.id, item.days)}>{item.label}</button>)}
          </div>
          <div className="date-inputs">
            <label><span>시작일</span><div className="date-field"><input type="text" inputMode="numeric" aria-label="분석 시작일" value={draft.start} onChange={(event) => setDraft({ ...draft, preset: "custom", start: event.target.value })} /><Icon name="calendar" size={14} /></div></label>
            <span>→</span>
            <label><span>종료일</span><div className="date-field"><input type="text" inputMode="numeric" aria-label="분석 종료일" value={draft.end} onChange={(event) => setDraft({ ...draft, preset: "custom", end: event.target.value })} /><Icon name="calendar" size={14} /></div></label>
          </div>
          <div className="compare-block">
            <b>어떤 기간과 비교할까요?</b>
            <div>
              {[
                ["none", "비교 안 함"],
                ["previous", "바로 이전 같은 기간"],
                ["year", "지난해 같은 기간"],
              ].map(([key, label]) => <button key={key} className={draft.compare === key ? "active" : ""} onClick={() => setDraft({ ...draft, compare: key as DateRangeValue["compare"] })}>{draft.compare === key && <Icon name="check" size={14} />}{label}</button>)}
            </div>
          </div>
          <div className="date-popover-footer"><button className="secondary-button" onClick={() => setDraft(value)}>초기화</button><button className="primary-button" onClick={() => { onChange(draft); setOpenMenu(null); }}>적용</button></div>
        </div>
      )}
    </div>
  );
}

export function MetricCard({ label, value, change, compareValue, help, tone = "neutral", spark }: { label: string; value: string; change?: string; compareValue?: string; help: string; tone?: "neutral" | "good" | "warn"; spark?: number[] }) {
  return (
    <article className="metric-card">
      <div className="metric-label"><span>{label}</span><span className="help-dot" title={help}><Icon name="info" size={14} /></span></div>
      <div className="metric-value-row"><strong>{value}</strong>{change && <span className={tone}>{change}</span>}</div>
      <div className="metric-foot"><span>{compareValue ?? "선택 기간의 실제 이벤트 집계"}</span>{spark && <MiniSparkline values={spark} tone={tone} />}</div>
    </article>
  );
}

export function MiniSparkline({ values, tone = "neutral" }: { values: number[]; tone?: "neutral" | "good" | "warn" }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 74},${22 - ((value - min) / Math.max(1, max - min)) * 18}`).join(" ");
  return <svg className={`mini-spark ${tone}`} viewBox="0 0 74 24" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>;
}

export type LineSeries = { id: string; label: string; color: string; values: Array<{ x: string; y: number }> };

export function TimeSeriesChart({ series, height = 280, compareSeries }: { series: LineSeries[]; height?: number; compareSeries?: LineSeries[] }) {
  const all = [...series, ...(compareSeries ?? [])];
  const max = Math.max(1, ...all.flatMap((item) => item.values.map((point) => point.y)));
  const min = Math.min(0, ...all.flatMap((item) => item.values.map((point) => point.y)));
  const width = 900;
  const top = 18;
  const bottom = 36;
  const left = 44;
  const right = 18;
  const chartHeight = height - top - bottom;
  const chartWidth = width - left - right;
  const count = Math.max(2, ...all.map((item) => item.values.length));
  const toPath = (values: LineSeries["values"]) => values.map((point, index) => {
    const x = left + (index / Math.max(1, count - 1)) * chartWidth;
    const y = top + (1 - (point.y - min) / Math.max(1, max - min)) * chartHeight;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const labels = series[0]?.values ?? [];
  const labelEvery = Math.max(1, Math.ceil(labels.length / 6));
  return (
    <div className="timeseries-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="기간별 추세 그래프">
        {[0, .25, .5, .75, 1].map((ratio) => {
          const y = top + ratio * chartHeight;
          const label = max - ratio * (max - min);
          return <g key={ratio}><line className="grid-line" x1={left} x2={width - right} y1={y} y2={y} /><text className="axis-label" x={left - 8} y={y + 4} textAnchor="end">{Math.round(label)}</text></g>;
        })}
        {(compareSeries ?? []).map((item) => <path key={`compare-${item.id}`} className="series-line compare" d={toPath(item.values)} stroke={item.color} />)}
        {series.map((item) => <path key={item.id} className="series-line" d={toPath(item.values)} stroke={item.color} />)}
        {labels.map((point, index) => index % labelEvery === 0 || index === labels.length - 1 ? <text key={point.x} className="axis-label x" x={left + (index / Math.max(1, count - 1)) * chartWidth} y={height - 9} textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}>{point.x.slice(5).replace("-", ".")}</text> : null)}
      </svg>
      <div className="chart-legend">{series.map((item) => <span key={item.id}><i style={{ background: item.color }} />{item.label}</span>)}{compareSeries && <span className="compare-legend"><i />이전 같은 기간</span>}</div>
    </div>
  );
}

export type FunnelStage = { id: string; label: string; count: number; medianSeconds?: number; description?: string };

export function CurvedFunnel({ stages, selected, onSelect }: { stages: FunnelStage[]; selected?: string; onSelect?: (id: string) => void }) {
  const width = 760;
  const height = Math.max(360, stages.length * 64 + 28);
  const max = Math.max(1, stages[0]?.count ?? 1);
  const center = 300;
  const maxWidth = 480;
  const minWidth = 46;
  const rowH = (height - 34) / Math.max(1, stages.length);
  const widths = stages.map((stage) => minWidth + (stage.count / max) * (maxWidth - minWidth));
  const colors = ["#5b55e7", "#6863ea", "#7772ed", "#8783ef", "#9793f2", "#a9a6f4", "#bbb8f5", "#cdcbf7", "#deddf9"];
  return (
    <div className="curved-funnel">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="질문에서 상품 행동까지의 곡선형 전환 퍼널">
        {stages.map((stage, index) => {
          const y = 12 + index * rowH;
          const topW = widths[index];
          const bottomW = widths[index + 1] ?? Math.max(minWidth, topW * .86);
          const topL = center - topW / 2;
          const topR = center + topW / 2;
          const botL = center - bottomW / 2;
          const botR = center + bottomW / 2;
          const curve = Math.min(16, rowH * .24);
          const path = `M ${topL} ${y + curve} Q ${topL} ${y} ${topL + curve} ${y} L ${topR - curve} ${y} Q ${topR} ${y} ${topR} ${y + curve} C ${topR} ${y + rowH * .55} ${botR} ${y + rowH * .55} ${botR} ${y + rowH - curve} Q ${botR} ${y + rowH} ${botR - curve} ${y + rowH} L ${botL + curve} ${y + rowH} Q ${botL} ${y + rowH} ${botL} ${y + rowH - curve} C ${botL} ${y + rowH * .55} ${topL} ${y + rowH * .55} ${topL} ${y + curve} Z`;
          const previous = index === 0 ? stage.count : stages[index - 1].count;
          const stepRate = previous ? stage.count / previous * 100 : 0;
          const totalRate = stage.count / max * 100;
          return (
            <g key={stage.id} className={`funnel-stage ${selected === stage.id ? "selected" : ""}`} role="button" tabIndex={0} onClick={() => onSelect?.(stage.id)} onKeyDown={(event) => { if (event.key === "Enter") onSelect?.(stage.id); }}>
              <path d={path} fill={colors[index % colors.length]} />
              <text className="funnel-inside-label" x={center} y={y + rowH / 2 - 3} textAnchor="middle">{stage.label}</text>
              <text className="funnel-inside-value" x={center} y={y + rowH / 2 + 17} textAnchor="middle">{stage.count.toLocaleString("ko-KR")}</text>
              <line className="funnel-guide" x1={center + topW / 2 + 10} x2="548" y1={y + rowH / 2} y2={y + rowH / 2} />
              <text className="funnel-rate" x="562" y={y + rowH / 2 - 4}>{index === 0 ? "시작" : `이전 단계의 ${stepRate.toFixed(1)}%`}</text>
              <text className="funnel-sub" x="562" y={y + rowH / 2 + 15}>처음 대비 {totalRate.toFixed(1)}%{index > 0 ? ` · ${Math.max(0, previous - stage.count).toLocaleString("ko-KR")} 이탈` : ""}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export type JourneyNode = { id: string; label: string; column: number; order: number; count: number; tone?: "default" | "safe" | "stop" | "action" };
export type JourneyLink = { source: string; target: string; count: number };

export function JourneySankey({ nodes, links, selected, onSelect }: { nodes: JourneyNode[]; links: JourneyLink[]; selected?: string; onSelect?: (id: string) => void }) {
  const width = 1050;
  const height = 470;
  const nodeWidth = 150;
  const columnGap = 76;
  const rowGap = 20;
  const maxByColumn = new Map<number, number>();
  for (const node of nodes) maxByColumn.set(node.column, Math.max(maxByColumn.get(node.column) ?? 0, node.order));
  const pos = new Map<string, { x: number; y: number; h: number }>();
  for (const node of nodes) {
    const rows = (maxByColumn.get(node.column) ?? 0) + 1;
    const available = height - 80 - rowGap * (rows - 1);
    const rowH = Math.min(86, available / rows);
    const total = rows * rowH + (rows - 1) * rowGap;
    const y = 40 + (height - 80 - total) / 2 + node.order * (rowH + rowGap);
    pos.set(node.id, { x: 18 + node.column * (nodeWidth + columnGap), y, h: rowH });
  }
  const maxLink = Math.max(1, ...links.map((link) => link.count));
  const rootCount = Math.max(1, ...nodes.filter((node) => node.column === 0).map((node) => node.count));
  return (
    <div className="journey-sankey">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="사용자 행동 경로 지도">
        <g className="journey-links">
          {links.map((link) => {
            const from = pos.get(link.source);
            const to = pos.get(link.target);
            if (!from || !to) return null;
            const x1 = from.x + nodeWidth;
            const y1 = from.y + from.h / 2;
            const x2 = to.x;
            const y2 = to.y + to.h / 2;
            const mid = (x1 + x2) / 2;
            const active = !selected || selected === link.source || selected === link.target;
            return <path key={`${link.source}-${link.target}`} d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`} style={{ strokeWidth: 3 + (link.count / maxLink) * 24 }} className={active ? "active" : "dimmed"} />;
          })}
        </g>
        <g className="journey-nodes">
          {nodes.map((node) => {
            const p = pos.get(node.id)!;
            const connected = !selected || selected === node.id || links.some((link) => (link.source === selected && link.target === node.id) || (link.target === selected && link.source === node.id));
            return <g key={node.id} className={`${node.tone ?? "default"} ${selected === node.id ? "selected" : connected ? "" : "dimmed"}`} role="button" tabIndex={0} onClick={() => onSelect?.(node.id)} onKeyDown={(event) => { if (event.key === "Enter") onSelect?.(node.id); }}>
              <rect x={p.x} y={p.y} width={nodeWidth} height={p.h} rx="7" />
              <text className="node-label" x={p.x + 12} y={p.y + 25}>{node.label}</text>
              <text className="node-count" x={p.x + 12} y={p.y + 49}>{node.count.toLocaleString("ko-KR")}건</text>
              <text className="node-rate" x={p.x + nodeWidth - 12} y={p.y + 49} textAnchor="end">{(node.count / rootCount * 100).toFixed(1)}%</text>
            </g>;
          })}
        </g>
      </svg>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><span><Icon name="search" size={22} /></span><b>{title}</b><p>{body}</p></div>;
}
