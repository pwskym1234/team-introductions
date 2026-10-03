import { aggregateBrandEvents } from "./analytics.ts";
import { decide } from "./engine.ts";
import { createSyntheticCatalog, createSyntheticInputs } from "./fixtures.ts";

const catalog = createSyntheticCatalog();
const decisions = createSyntheticInputs().map((input) => decide(input, catalog));
const aggregate = aggregateBrandEvents(
  decisions.flatMap((decision) => decision.events),
  "2026-10-03T14:30:00+09:00"
);

for (const decision of decisions) {
  console.log(`\n${decision.requestId}: ${decision.disposition}`);
  console.log("judgments:", decision.judgments.map((item) => `${item.kind}:${item.status}`).join(", "));
  console.log("eligible:", decision.eligible.map((item) => `${item.product.productId}(${item.score?.toFixed(1)})`).join(", ") || "none");
  console.log("excluded:", decision.excluded.map((item) => `${item.product.productId}:${item.exclusionReasons.map((reason) => reason.code).join("+")}`).join(", ") || "none");
}

console.log("\nBRAND AGGREGATE");
console.log(JSON.stringify(aggregate, null, 2));
