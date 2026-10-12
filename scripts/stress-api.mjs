#!/usr/bin/env node
/** Concurrent POST /api/orders — scale demo when DEMO_HANDLER_DELAY_MS / DEMO_MAX_INFLIGHT set. */
const base = process.env.API_URL || "http://127.0.0.1:8080";
const n = Number(process.env.N || 40);

const url = `${base.replace(/\/$/, "")}/api/orders`;
const wall = Date.now();
const results = await Promise.allSettled(
  Array.from({ length: n }, async (_, i) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_email: `stress-${Date.now()}-${i}@example.com`,
        amount_cents: 500 + i,
      }),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, error: body.error };
  })
);
const statuses = {};
for (const r of results) {
  const code = r.status === "fulfilled" ? r.value.status : "throw";
  statuses[code] = (statuses[code] || 0) + 1;
}
let health = null;
try {
  health = await (await fetch(`${base.replace(/\/$/, "")}/api/health`)).json();
} catch {
  /* ignore */
}
console.log(
  JSON.stringify(
    { url, n, wall_ms: Date.now() - wall, statuses, demo: health?.demo || null },
    null,
    2
  )
);
