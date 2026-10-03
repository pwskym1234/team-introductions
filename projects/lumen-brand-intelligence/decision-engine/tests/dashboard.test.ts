import assert from "node:assert/strict";
import test from "node:test";
import { aggregateBrandEvents } from "../src/analytics.ts";
import { renderBrandDashboard } from "../src/brand-dashboard.ts";
import { decide } from "../src/engine.ts";
import { createSyntheticCatalog, createSyntheticInputs } from "../src/fixtures.ts";

test("brand dashboard renders engine aggregate without raw health text or user IDs", () => {
  const catalog = createSyntheticCatalog();
  const inputs = createSyntheticInputs();
  const decisions = inputs.map((input) => decide(input, catalog));
  const aggregate = aggregateBrandEvents(
    decisions.flatMap((decision) => decision.events),
    "2026-10-03T14:30:00+09:00"
  );
  const html = renderBrandDashboard(aggregate, decisions, catalog);

  assert.match(html, /BRAND DECISION INTELLIGENCE/);
  assert.match(html, /질문→판정→추천 퍼널/);
  assert.match(html, /상품 노출·탈락·정보 결측/);
  assert.match(html, /합성 데모 · 실제 성과 아님/);
  assert.match(html, /알레르기 일치/);
  assert.doesNotMatch(html, /배가 심하게|반복해서 토해요|증량 뒤 식사량/);
  for (const input of inputs) assert.doesNotMatch(html, new RegExp(input.userId));
});
