import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the marketer analytics product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Lumen 브랜드 분석<\/title>/i);
  assert.match(html, /질문 분석/);
  assert.match(html, /전환/);
  assert.match(html, /여정/);
  assert.match(html, /DEMO DATA/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|react-loading-skeleton/i);
});

test("server-renders the plain-language engine guide", async () => {
  const response = await render("/engine-guide");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /추천 엔진 이해하기/);
  assert.match(html, /질문 한 개를 끝까지 따라가 보기/);
  assert.match(html, /아무 일도 없는데 경보가 울리는 비율/);
  assert.match(html, /56 → 82/);
});

test("ships a detailed event ledger and custom interactive controls", async () => {
  const [productApp, analytics, controls, guide, page] = await Promise.all([
    readFile(new URL("../app/ProductApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/analytics.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AnalyticsUI.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/engine-guide/EngineGuideApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(productApp, /buildOrderedFunnel/);
  assert.match(productApp, /filter-rule-editor/);
  assert.match(productApp, /고객 그룹으로 저장/);
  assert.doesNotMatch(productApp, /<select\b/i);
  assert.match(controls, /최근 90일/);
  assert.match(controls, /지난달/);
  assert.match(controls, /직접 설정/);
  assert.match(controls, /바로 이전 같은 기간/);
  assert.match(analytics, /Exactly 6,200 anonymous users and 12,400 questions/);
  assert.match(analytics, /queryOrderedFunnel/);
  assert.match(analytics, /queryJourneyTransitions/);
  assert.match(guide, /통계적 불확실성/);
  assert.match(page, /<ProductApp \/>/);
});
