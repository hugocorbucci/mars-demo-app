#!/usr/bin/env node
/** Concurrent GET /api/orders/by-email load. */
const base = process.env.API_URL || "http://127.0.0.1:8080";
const email = process.env.HOTPATH_EMAIL || "hotpath@example.com";
const n = Number(process.env.N || 40);

const url = `${base.replace(/\/$/, "")}/api/orders/by-email?email=${encodeURIComponent(email)}`;
const wall = Date.now();
const results = await Promise.allSettled(
  Array.from({ length: n }, async () => {
    const t0 = Date.now();
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, took_ms: body.took_ms ?? Date.now() - t0 };
  })
);
const ok = results.filter((r) => r.status === "fulfilled" && r.value.status < 400);
const times = ok.map((r) => r.value.took_ms).sort((a, b) => a - b);
const p50 = times[Math.floor(times.length * 0.5)];
const p95 = times[Math.floor(times.length * 0.95)];
console.log(
  JSON.stringify(
    {
      url,
      n,
      wall_ms: Date.now() - wall,
      ok: ok.length,
      fail: n - ok.length,
      p50_ms: p50,
      p95_ms: p95,
    },
    null,
    2
  )
);
