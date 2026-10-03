import { createServer } from "node:http";
import { aggregateBrandEvents } from "./analytics.ts";
import { renderBrandDashboard } from "./brand-dashboard.ts";
import { decide } from "./engine.ts";
import { createSyntheticCatalog, createSyntheticInputs } from "./fixtures.ts";

const catalog = createSyntheticCatalog();
const decisions = createSyntheticInputs().map((input) => decide(input, catalog));
const aggregate = aggregateBrandEvents(
  decisions.flatMap((decision) => decision.events),
  "2026-10-03T14:30:00+09:00"
);
const page = renderBrandDashboard(aggregate, decisions, catalog);
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const server = createServer((request, response) => {
  if (request.url === "/api/aggregate") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify(aggregate, null, 2));
    return;
  }
  if (request.url === "/" || request.url === "/index.html") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(page);
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Brand dashboard: http://localhost:${port}`);
});
